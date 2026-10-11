import { setTimeout as sleep } from 'node:timers/promises'
import { collect } from '../feedback.js'
import { mdItem } from '../format.js'
import { consumerName } from '../state.js'
import { t } from '../i18n.js'
import { authState, entries } from './shared.js'

const DEFAULT_INTERVAL = 60
const MAX_INTERVAL = 900
const BACKOFF = 1.5

/**
 * Long-running listener for agents: run it in the background and treat every
 * stdout block as new feedback. Quiet feeds are polled less and less often,
 * activity resets the pace. Status goes to stderr so stdout is only feedback.
 */
export default async ({ opts }) => {
  const consumer = consumerName(opts)
  const usable = entries(opts).filter((e) => ['ok', 'none'].includes(authState(e)))
  const base = Number(opts.interval ?? DEFAULT_INTERVAL)
  const max = Math.max(base, MAX_INTERVAL)
  let interval = base
  let lastErrors = ''
  process.stderr.write(t('watch.start', { count: usable.length, consumer, interval: base }) + '\n')

  while (true) {
    const { groups, errors } = await collect(usable, { since: 'last', consumer, limit: opts.limit })
    const fresh = groups.flatMap((g) => g.items)
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
