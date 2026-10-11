/**
 * Mark who wrote an item, relative to the project:
 * - "self": the account feedbai reads with (e.g. the agent's own reports)
 * - "maintainer": listed in the project's `maintainers`
 * Platforms authenticate authors, so a message cannot claim a role by its text.
 */
const selfIds = (account) => [account?.user, account?.identifier, account?.did].filter(Boolean)

export const roleOf = (entry, { project, account }) => {
  if (selfIds(account).includes(entry.author.id)) return 'self'
  if ((project.maintainers ?? []).includes(entry.author.id)) return 'maintainer'
  return undefined
}

export const withRoles = (items, context) =>
  items.map((entry) => {
    const role = roleOf(entry, context)
    return role ? { ...entry, role } : entry
  })
