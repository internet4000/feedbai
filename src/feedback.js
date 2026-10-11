import { readState, writeState, stateKey } from './state.js'
import { parseSince } from './since.js'
import { t } from './i18n.js'

/**
 * Fetch every selected source in parallel. Failures are reported per source
 * instead of aborting the whole run.
 * `since` is a parseSince() value or "last" (use and advance the saved cursor).
 */
export const collect = async (entries, { since, limit, fetchImpl, now = new Date() } = {}) => {
  const useState = since === 'last'
  const state = useState ? readState() : null
  const fixedSince = useState ? null : parseSince(since)

  const results = await Promise.allSettled(
    entries.map(({ project, source, account, provider }) => {
      const cursor = useState ? state.sources[stateKey(project, source)] : null
      return provider.fetch({
        project,
        source,
        account,
        since: cursor ? new Date(cursor) : fixedSince,
        limit: Number(limit ?? source.limit),
        fetchImpl,
      })
    }),
  )

  const groups = []
  const errors = []
  results.forEach((result, i) => {
    const { project, source } = entries[i]
    if (result.status === 'fulfilled') {
      groups.push({ project: project.id, source: source.id, platform: source.type, items: result.value })
      if (useState) state.sources[stateKey(project, source)] = now.toISOString()
    } else {
      errors.push({ project: project.id, source: source.id, error: t('error.sourceFailed', { source: source.id, reason: result.reason.message }) })
    }
  })
  if (useState) writeState(state)
  return { groups, errors }
}
