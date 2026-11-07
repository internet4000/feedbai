import { setTimeout as sleep } from 'node:timers/promises'
import { collect } from '../feedback.js'
import { mdItem } from '../format.js'
import { consumerName } from '../state.js'
import { t } from '../i18n.js'
import { authState, entries } from './shared.js'

const DEFAULT_INTERVAL = 60
const MAX_INTERVAL = 900
const BACKOFF = 1.5
/** A refused login is not retried (it would only lock the account); a rate limit waits this long. */
const RATE_LIMIT_PAUSE = 15 * 60

/**
 * Long-running listener for agents: run it in the background and treat every
 * stdout block as new feedback. Quiet feeds are polled less and less often,
 * activity resets the pace. Status goes to stderr so stdout is only feedback.
 */
export default async ({ opts }) => {
  const consumer = consumerName(opts)
  const usable = entries(opts).filter((e) => ['ok', 'none', 'hub'].includes(authState(e)))
  const base = Number(opts.interval ?? DEFAULT_INTERVAL)
  const max = Math.max(base, MAX_INTERVAL)
  let interval = base
  let lastErrors = ''
  const paused = new Map() // source key → resume time (Infinity: login refused, fix it and restart)
  const keyOf = (e) => `${e.project.id ?? e.project}/${e.source.id ?? e.source}`
  const seen = new Set() // polls overlap (cursor = poll start), so the same item can come back once
  process.stderr.write(t('watch.start', { count: usable.length, consumer, interval: base }) + '\n')

  while (true) {
    const active = usable.filter((e) => !(paused.get(keyOf(e)) > Date.now()))
    const { groups, errors } = await collect(active, { since: 'last', consumer, limit: opts.limit })
    for (const e of errors) {
      if (e.status !== 401 && e.status !== 429) continue
      paused.set(keyOf(e), e.status === 401 ? Infinity : Date.now() + RATE_LIMIT_PAUSE * 1000)
      process.stderr.write(t(e.status === 401 ? 'watch.pausedLogin' : 'watch.pausedRate', { source: keyOf(e), minutes: RATE_LIMIT_PAUSE / 60 }) + '\n')
    }
    const fresh = groups.flatMap((g) => g.items).filter((entry) => !seen.has(entry.id) && entry.role !== 'agent')
    for (const entry of fresh) seen.add(entry.id)
    if (fresh.length) {
      const lines = fresh.map((entry) => `[${entry.project}/${entry.source}] ${mdItem(entry).slice(2)}`)
      process.stdout.write(lines.join('\n') + '\n')
      interval = base
    } else {
      interval = Math.min(max, Math.round(interval * BACKOFF))
    }
    const errorText = errors.map((e) => e.error).join('\n')
    if (errorText !== lastErrors) process.stderr.write((errorText || t('watch.recovered')) + '\n')
    lastErrors = errorText
    await sleep(interval * 1000)
  }
}
