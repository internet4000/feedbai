import { threads, truncate } from './digest.js'
import { collect } from './feedback.js'
import { withRoles } from './roles.js'
import { t } from './i18n.js'

/**
 * Turn feedback into GitHub issues: one issue per thread, later items as comments.
 * Hidden markers in bodies/comments make runs idempotent, so overlapping
 * windows (e.g. an hourly Action with --since 2h) never duplicate anything.
 */

export const LABEL = 'feedback'

/**
 * Chat rooms are conversations, not a backlog: a Matrix message starts an issue
 * only when it mentions the bot account. Bluesky sources are already targeted.
 */
const triggers = (entry) => entry.role !== 'agent' && (entry.platform !== 'matrix' || Boolean(entry.toSelf))

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

const quote = (entry) => {
  const who = entry.author.name ? `${entry.author.name} (${entry.author.id})` : entry.author.id
  const role = entry.role ? ` [${t(`role.${entry.role}`)}]` : ''
  const text = entry.text.split('\n').map((line) => `> ${line}`).join('\n')
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
    const trigger = all.find(triggers)
    if (!linked && !trigger) continue
    const body = fresh.map(quote).join('\n\n')
    if (linked) actions.push({ type: 'comment', issue: linked, body })
    else {
      const title = `${t('issues.titlePrefix')} ${truncate(oneLine(trigger.text), 72)}`
      actions.push({ type: 'create', title, body: `${t('issues.header', { source: `${root.project}/${root.source}` })}\n\n${body}` })
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

/** Fetch feedback for `entries` and file it in `client`'s repo. Returns { actions, urls, errors }. */
export const fileIssues = async ({ entries, client, since = '1d', limit, dryRun = false }) => {
  const { groups, errors } = await collect(entries, { since, limit })
  const items = await withContext(groups.flatMap((g) => g.items), entries)
  const actions = planIssues(items, await indexIssues(client))
  if (dryRun || !actions.length) return { actions, urls: [], errors }
  await client.ensureLabel({ name: LABEL, color: '0E8A16', description: t('issues.labelDescription') })
  return { actions, urls: await applyIssues(actions, client), errors }
}
