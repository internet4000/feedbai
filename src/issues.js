import { execFileSync } from 'node:child_process'
import { threads, truncate } from './digest.js'
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
const triggers = (entry) => entry.platform !== 'matrix' || Boolean(entry.toSelf)

const itemMarker = (id) => `<!-- feedbai:item=${id} -->`
const ITEM_RE = /<!-- feedbai:item=(.+?) -->/g

const oneLine = (text) => text.replace(/\s+/g, ' ').trim()

/** gh CLI runner; injectable for tests. */
export const gh = (args, input) =>
  execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'inherit'] })

/** item id -> issue number, from every feedback issue body and comment. */
export const indexIssues = (run) => {
  const issues = JSON.parse(run(['issue', 'list', '--label', LABEL, '--state', 'all', '--limit', '1000', '--json', 'number,body,comments']))
  const index = new Map()
  for (const issue of issues) {
    const texts = [issue.body ?? '', ...(issue.comments ?? []).map((c) => c.body ?? '')]
    for (const text of texts) for (const m of text.matchAll(ITEM_RE)) index.set(m[1], issue.number)
  }
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
    const linked = all.map((entry) => index.get(entry.id) ?? index.get(entry.replyTo) ?? index.get(entry.thread)).find(Boolean)
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

export const applyIssues = (actions, run) =>
  actions.map((action) =>
    action.type === 'create'
      ? run(['issue', 'create', '--label', LABEL, '--title', action.title, '--body-file', '-'], action.body).trim()
      : run(['issue', 'comment', String(action.issue), '--body-file', '-'], action.body).trim(),
  )

export const ensureLabel = (run) => {
  try {
    run(['label', 'create', LABEL, '--color', '0E8A16', '--description', t('issues.labelDescription')])
  } catch {
    // already exists
  }
}
