import { t } from './i18n.js'
import { threads, truncate } from './digest.js'

/** Above this many items in a source, md output switches to a per-thread digest. */
export const DIGEST_THRESHOLD = 30
const DIGEST_TEXT = 280
const DIGEST_REPLY = 140

const oneLine = (text) => text.replace(/\s*\n\s*/g, ' ⏎ ').trim()

const who = (entry) => {
  const name = entry.author.name ? `${entry.author.name} (${entry.author.id})` : entry.author.id
  return entry.role ? `${name} [${t(`role.${entry.role}`)}]` : name
}

export const mdItem = (entry, max = Infinity) => {
  const reply = entry.replyTo ? ` ${t('md.reply', { target: entry.replyTo })}` : ''
  const edit = entry.edits ? ` ${t('md.edit', { target: entry.edits })}` : ''
  return `- ${entry.createdAt} **${who(entry)}**${reply}${edit} — ${truncate(oneLine(entry.text), max)}\n  <${entry.url}>`
}

/** Maintainer messages in full, then one line per thread with reply count and latest reply. */
const mdDigest = (items) => {
  const lines = []
  const maintainers = items.filter((entry) => entry.role === 'maintainer')
  if (maintainers.length) lines.push(t('md.fromMaintainers'), ...maintainers.map((entry) => mdItem(entry)))
  lines.push(t('md.threads', { count: items.length }))
  for (const { root, replies } of threads(items)) {
    lines.push(mdItem(root, DIGEST_TEXT))
    const last = replies.at(-1)
    if (last) lines.push(`  ${t('md.replies', { count: replies.length, who: who(last), text: truncate(oneLine(last.text), DIGEST_REPLY) })}`)
  }
  return lines.join('\n')
}

const mdItems = (items, digest) => {
  if (!items.length) return t('md.empty')
  if (digest === true || (digest !== false && items.length > DIGEST_THRESHOLD)) return mdDigest(items)
  return items.map((entry) => mdItem(entry)).join('\n')
}

/** Compact Markdown: cheap on tokens, easy for agents and humans to read. */
const md = ({ groups, errors }, { title, depth = 2, digest } = {}) => {
  const heading = '#'.repeat(depth)
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const parts = [title ?? t('md.header', { count: total })]
  if (total) parts.push(t('md.untrusted'))
  for (const group of groups) {
    parts.push(`${heading} ${t('md.source', { ...group, count: group.items.length })}`)
    for (const notice of group.notices ?? []) parts.push(`> ⚠ ${notice}`)
    parts.push(mdItems(group.items, digest))
  }
  if (errors.length) parts.push(`${heading} ${t('md.errors')}`, errors.map((e) => `- ${e.error}`).join('\n'))
  return parts.join('\n\n') + '\n'
}

const json = (result) => JSON.stringify(result, null, 2) + '\n'

const ndjson = ({ groups, errors }) =>
  [
    ...groups.flatMap((g) => [...(g.notices ?? []).map((notice) => ({ project: g.project, source: g.source, notice })), ...g.items]),
    ...errors.map((e) => ({ error: e })),
  ].map((x) => JSON.stringify(x)).join('\n') + '\n'

export const formats = { md, json, ndjson }
