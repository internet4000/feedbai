import { threads, truncate } from './digest.js'
import { collect } from './feedback.js'
import { withRoles } from './roles.js'
import { t } from './i18n.js'
import { providers } from './providers/index.js'

/**
 * Turn feedback into GitHub issues: one issue per thread, later items as comments.
 * Hidden markers in bodies/comments make runs idempotent, so overlapping
 * windows (e.g. an hourly Action with --since 2h) never duplicate anything.
 */

export const LABEL = 'feedback'

/**
 * What may start an issue: on channels whose provider says `filing: 'mentions'` (chat rooms:
 * conversations, not a backlog) only messages that mention the bot; elsewhere any message.
 * Agents never start one (they often name the bot when reporting): known by account, never by text.
 */
const triggers = (entry) =>
  entry.role !== 'agent' && (providers[entry.platform]?.filing !== 'mentions' || Boolean(entry.toSelf))

/** Sources that are filed at all: a provider's `files(source)` can keep some read-only (e.g. Bluesky searches: sentiment). */
export const filesIssues = ({ source }) => providers[source.type]?.files?.(source) ?? true

const itemMarker = (id) => `<!-- feedbai:item=${id} -->`
const ITEM_RE = /<!-- feedbai:item=(.+?) -->/g

const oneLine = (text) => text.replace(/\s+/g, ' ').trim()

/** item id -> issue number, from feedback issue bodies and all issue comments (REST: consistent after writes). */
export const indexIssues = async (client) => {
  const index = new Map()
  const add = (number, text) => {
    for (const m of (text ?? '').matchAll(ITEM_RE)) if (!index.has(m[1])) index.set(m[1], number)
  }
  for (const issue of (await client.issues(LABEL)).sort((a, b) => a.number - b.number)) add(issue.number, issue.body)
  for (const comment of await client.comments()) add(Number(comment.issue_url.split('/').pop()), comment.body)
  return index
}

/**
 * User text made inert for a GitHub issue (a zero-width space breaks each autolink):
 * - "@name" would notify that GitHub user;
 * - "#12", "owner/repo#12", "GH-12" and github.com issue links would add a "mentioned this" event to
 *   that issue, in any public repo (feedbai would become a way to spam other projects);
 * - "<!--" could hide text or forge an item marker.
 */
export const inert = (text) =>
  text
    .replace(/@(?=[\w-])/g, '@\u200b')
    .replace(/#(?=\d)/g, '#\u200b')
    .replace(/\bGH-(?=\d)/gi, (m) => `${m.slice(0, 2)}\u200b-`)
    .replace(/\bgithub\.com\//gi, (m) => `${m.slice(0, 6)}\u200b${m.slice(6)}`)
    .replace(/<!--/g, '&lt;!--')

const quote = (entry) => {
  const who = inert(entry.author.name ? `${entry.author.name} (${entry.author.id})` : entry.author.id)
  const role = entry.role ? ` [${t(`role.${entry.role}`)}]` : ''
  const text = inert(entry.text).split('\n').map((line) => `> ${line}`).join('\n')
  return `**${who}**${role} · ${entry.createdAt} · [${entry.platform}](${entry.url})\n${text}\n${itemMarker(entry.id)}`
}

/** Plan actions without side effects: [{ type: 'create', title, body } | { type: 'comment', issue, body }]. */
export const planIssues = (items, index) => {
  const actions = []
  const known = (entry) => index.has(entry.id)
  for (const { root, replies } of threads(items)) {
    const all = [root, ...replies]
    const fresh = all.filter((entry) => !known(entry))
    if (!fresh.length) continue
    const linked = all.map((entry) => index.get(entry.id) ?? index.get(entry.replyTo) ?? index.get(entry.edits) ?? index.get(entry.thread)).find(Boolean)
    if (linked === 'pending') continue // its issue is created in this run: comment on the next one
    const trigger = all.find(triggers)
    if (!linked && !trigger) continue
    const body = fresh.map(quote).join('\n\n')
    if (linked) actions.push({ type: 'comment', issue: linked, body })
    else {
      const title = `${t('issues.titlePrefix')} ${truncate(inert(oneLine(trigger.text)), 72)}`
      // A thread key that isn't a message (e.g. a day of feedback records) gets a marker too, so later runs add to this issue
      const keys = [...new Set(all.map((entry) => entry.thread).filter((key) => key && !all.some((entry) => entry.id === key)))]
      actions.push({ type: 'create', title, body: `${t('issues.header', { source: `${root.project}/${root.source}` })}\n\n${body}${keys.map((key) => `\n${itemMarker(key)}`).join('')}` })
      for (const key of keys) index.set(key, 'pending')
    }
    for (const entry of fresh) index.set(entry.id, linked ?? 'pending')
  }
  return actions
}

export const applyIssues = async (actions, client) => {
  const urls = []
  for (const action of actions) {
    const result =
      action.type === 'create'
        ? await client.createIssue({ title: action.title, body: action.body, labels: [LABEL] })
        : await client.comment(action.issue, action.body)
    urls.push(result.html_url)
  }
  return urls
}

/** Mentions that reply to older messages get those messages too, so issues are self-contained. */
const withContext = async (items, entries) => {
  const ids = new Set(items.map((entry) => entry.id))
  for (const entry of items.filter((e) => e.toSelf && e.replyTo && !ids.has(e.replyTo))) {
    const from = entries.find((e) => e.project.id === entry.project && e.source.id === entry.source)
    const chain = (await from?.provider.ancestors?.({ ...from, entry })) ?? []
    for (const parent of withRoles(chain, from)) if (!ids.has(parent.id)) ids.add(parent.id) && items.push(parent)
  }
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/**
 * Sources whose messages may go to `repo`'s issues (see each provider's `mayFile`), and errors for the others.
 * `chosen`: an agent picked the messages itself, so read-only sources (searches) count too; `mayFile` still applies.
 */
const fileable = async (entries, repo, { chosen = false } = {}) => {
  const allowed = []
  const errors = []
  for (const entry of chosen ? entries : entries.filter(filesIssues)) {
    const refuse = (error) => errors.push({ project: entry.project.id, source: entry.source.id, error })
    try {
      if (await (entry.provider.mayFile?.({ ...entry, repo }) ?? true)) allowed.push(entry)
      else refuse(t('error.notFileable', { source: entry.source.id, repo }))
    } catch (error) {
      refuse(t('error.sourceFailed', { source: entry.source.id, reason: error.message }))
    }
  }
  return { allowed, errors }
}

/** Fetch feedback for `entries` and file it in `client`'s repo. Returns { actions, urls, errors }. */
export const fileIssues = async ({ entries, client, since = '1d', limit, dryRun = false }) => {
  const { allowed: actionable, errors: refused } = await fileable(entries, client.repo)
  const { groups, errors: failed } = await collect(actionable, { since, limit })
  const errors = [...refused, ...failed]
  const items = await withContext(groups.flatMap((g) => g.items), actionable)
  const actions = planIssues(items, await indexIssues(client))
  if (dryRun || !actions.length) return { actions, urls: [], errors }
  await client.ensureLabel({ name: LABEL, color: '0E8A16', description: t('issues.labelDescription') })
  return { actions, urls: await applyIssues(actions, client), errors }
}

/** A message link as feedbai prints it, comparable however it was copied (encoding, trailing slash). */
const linkKey = (link) => {
  try {
    return decodeURIComponent(link.trim()).replace(/\/$/, '')
  } catch {
    return link.trim()
  }
}

/**
 * `feedbai file`: the agent chose which messages make one issue, and wrote its title (and a summary).
 * Same format as automatic filing (quotes, links back, hidden markers), so duplicate checks and the
 * "This is fixed" replies work on it. Messages already filed go to their issue as a comment instead.
 * Returns { action, url, missing, errors }.
 */
export const fileChosen = async ({ entries, client, links, title, note = '', since = '30d', dryRun = false }) => {
  const { allowed, errors: refused } = await fileable(entries, client.repo, { chosen: true })
  const { groups, errors: failed } = await collect(allowed, { since, limit: 500 })
  const errors = [...refused, ...failed]
  const wanted = new Map(links.map((link) => [linkKey(link), link]))
  const items = groups.flatMap((g) => g.items).filter((entry) => wanted.has(linkKey(entry.url)) || wanted.has(linkKey(entry.id)))
  const found = new Set(items.flatMap((entry) => [linkKey(entry.url), linkKey(entry.id)]))
  const missing = [...wanted].filter(([key]) => !found.has(key)).map(([, link]) => link)
  if (!items.length) return { action: null, url: null, missing, errors }
  items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const index = await indexIssues(client)
  const filed = items.map((entry) => index.get(entry.id) ?? index.get(entry.thread)).find(Boolean)
  const fresh = items.filter((entry) => !index.has(entry.id))
  const quotes = fresh.map(quote).join('\n\n')
  // The agent's own words: no pings or hidden markers, but its links to this repo's issues (#70) stay links
  const summary = note.trim() ? `${note.trim().replace(/@(?=[\w-])/g, '@\u200b').replace(/<!--/g, '&lt;!--')}\n\n` : ''
  let action
  if (filed) action = fresh.length ? { type: 'comment', issue: filed, body: `${summary}${quotes}` } : { type: 'existing', issue: filed }
  else {
    const root = items[0]
    const keys = [...new Set(items.map((entry) => entry.thread).filter((key) => key && !items.some((entry) => entry.id === key)))]
    action = {
      type: 'create',
      title: truncate(inert(oneLine(title)), 120),
      body: `${summary}${t('issues.header', { source: `${root.project}/${root.source}` })}\n\n${quotes}${keys.map((key) => `\n${itemMarker(key)}`).join('')}`,
    }
  }
  if (dryRun || action.type === 'existing') return { action, url: action.type === 'existing' ? `https://github.com/${client.repo}/issues/${action.issue}` : null, missing, errors }
  await client.ensureLabel({ name: LABEL, color: '0E8A16', description: t('issues.labelDescription') })
  const [url] = await applyIssues([action], client)
  return { action, url, missing, errors }
}
