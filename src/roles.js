/**
 * Mark who wrote an item, relative to the project:
 * - "self": the account feedbai reads with (e.g. the agent's own reports)
 * - "agent": "self" + starts with 🤖 — a report feedbai posted (`feedbai post` prefixes it)
 * - "maintainer": listed in the project's `maintainers`
 * Platforms authenticate authors, so a message cannot claim a role by its text.
 */
const selfIds = (account) => [account?.user, account?.identifier, account?.did].filter(Boolean)

export const roleOf = (entry, { project, account }) => {
  if (selfIds(account).includes(entry.author.id)) return entry.text.startsWith('🤖') ? 'agent' : 'self'
  if ((project.maintainers ?? []).includes(entry.author.id)) return 'maintainer'
  return undefined
}

/** Matrix localpart / Bluesky handle as typed in a message, e.g. "soup123" from "@soup123:matrix.org". */
const selfNames = (account) => selfIds(account).map((id) => id.replace(/^@/, '').split(':')[0]).filter(Boolean)

/**
 * A real mention (Matrix `m.mentions`, set by clients for pills) or the name typed with "@".
 * Never the bare word: a bot is often named after its project, which its room says all the time.
 */
export const mentionsSelf = (entry, { account }) => {
  const ids = selfIds(account)
  if (entry.mentions?.some((id) => ids.includes(id))) return true
  const text = entry.text.toLowerCase()
  return selfNames(account).some((name) => new RegExp(`(^|[^\\w])@${name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w]|$)`).test(text))
}

export const withRoles = (items, context) =>
  items.map((entry) => {
    const role = roleOf(entry, context)
    const toSelf = role !== 'self' && mentionsSelf(entry, context)
    return { ...entry, ...(role && { role }), ...(toSelf && { toSelf }) }
  })
