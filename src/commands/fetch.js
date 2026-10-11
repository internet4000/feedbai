import { collect } from '../feedback.js'
import { formats } from '../format.js'
import { t } from '../i18n.js'
import { consumerName } from '../state.js'
import { entries, out } from './shared.js'

export default async ({ opts }) => {
  if (!formats[opts.format]) throw new Error(t('error.badFormat', { format: opts.format }))
  const result = await collect(entries(opts), { since: opts.since, limit: opts.limit, consumer: consumerName(opts) })
  out(formats[opts.format](result))
  if (result.errors.length) process.exitCode = 2
}
