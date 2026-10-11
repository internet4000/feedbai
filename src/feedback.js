import { readState, writeState, stateKey } from './state.js'
import { parseSince } from './since.js'
import { withRoles } from './roles.js'
import { t } from './i18n.js'

/**
 * Fetch every selected source in parallel. Failures are reported per source
 * instead of aborting the whole run.
 * `since` is a parseSince() value or "last" (use and advance `consumer`'s saved cursor).
 */
export const collect = async (entries, { since, limit, consumer, fetchImpl, now = new Date() } = {}) => {
  const useState = since === 'last'
  const state = useState ? readState() : null
  const fixedSince = useState ? null : parseSince(since)
  const key = ({ project, source }) => stateKey(project, source, consumer)

  const results = await Promise.allSettled(
    entries.map((entry) => {
      const cursor = useState ? state.sources[key(entry)] : null
      return entry.provider.fetch({
        ...entry,
        since: cursor ? new Date(cursor) : fixedSince,
        limit: Number(limit ?? entry.source.limit),
        fetchImpl,
      })
    }),
  )

  const groups = []
  const errors = []
  results.forEach((result, i) => {
    const { project, source, account } = entries[i]
    if (result.status === 'fulfilled') {
      const items = withRoles(result.value, { project, account })
      groups.push({ project: project.id, source: source.id, platform: source.type, items })
      if (useState) state.sources[key(entries[i])] = now.toISOString()
    } else {
      errors.push({ project: project.id, source: source.id, error: t('error.sourceFailed', { source: source.id, reason: result.reason.message }) })
    }
  })
  if (useState) writeState(state)
  return { groups, errors }
}
