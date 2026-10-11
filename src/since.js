import { t } from './i18n.js'

const UNITS = { m: 60e3, h: 3600e3, d: 86400e3, w: 7 * 86400e3 }

/** Parse "7d", "12h", "30m", "2w" or an ISO date into a Date (relative to `now`). */
export const parseSince = (value, now = Date.now()) => {
  if (!value) return null
  const match = /^(\d+)([mhdw])$/.exec(value)
  if (match) return new Date(now - Number(match[1]) * UNITS[match[2]])
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error(t('error.badSince', { value }))
  return date
}
