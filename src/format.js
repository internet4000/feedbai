import { t } from './i18n.js'

const oneLine = (text) => text.replace(/\s*\n\s*/g, ' ⏎ ').trim()

const mdItem = (entry) => {
  const who = entry.author.name ? `${entry.author.name} (${entry.author.id})` : entry.author.id
  const reply = entry.replyTo ? ` ${t('md.reply', { target: entry.replyTo })}` : ''
  return `- ${entry.createdAt} **${who}**${reply} — ${oneLine(entry.text)}\n  <${entry.url}>`
}

/** Compact Markdown: cheap on tokens, easy for agents and humans to read. */
const md = ({ groups, errors }, { title, depth = 2 } = {}) => {
  const heading = '#'.repeat(depth)
  const total = groups.reduce((n, g) => n + g.items.length, 0)
  const parts = [title ?? t('md.header', { count: total })]
  for (const group of groups) {
    parts.push(`${heading} ${t('md.source', { ...group, count: group.items.length })}`)
    parts.push(group.items.length ? group.items.map(mdItem).join('\n') : t('md.empty'))
  }
  if (errors.length) parts.push(`${heading} ${t('md.errors')}`, errors.map((e) => `- ${e.error}`).join('\n'))
  return parts.join('\n\n') + '\n'
}

const json = (result) => JSON.stringify(result, null, 2) + '\n'

const ndjson = ({ groups, errors }) =>
  [...groups.flatMap((g) => g.items), ...errors.map((e) => ({ error: e }))].map((x) => JSON.stringify(x)).join('\n') + '\n'

export const formats = { md, json, ndjson }
