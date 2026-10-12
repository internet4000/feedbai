import { loadConfig, selectSources } from '../config.js'
import { providers } from '../providers/index.js'
import { t } from '../i18n.js'
import { out } from './shared.js'

/** Every message feedbai sends says it comes from an agent. */
const LABEL = '🤖 '

/** Message from the remaining words, or stdin when it is "-". */
const message = async (words) => {
  if (words.join(' ') !== '-') return words.join(' ')
  let text = ''
  for await (const chunk of process.stdin) text += chunk
  return text.trim()
}

/**
 * `feedbai post <target> <text>`: target is an item link (e.g. matrix.to/#/!room/$event → reply
 * in that thread; providers recognise their own with `parseLink`) or a source id (new message there).
 */
export default async ({ opts, args }) => {
  const [target, ...words] = args
  const text = await message(words)
  if (!target || !text) throw new Error(t('error.missingField', { source: 'post', field: '<target> <text>' }))
  const { config } = loadConfig({ explicit: opts.config })
  const provider = Object.values(providers).find((p) => p.parseLink?.(target))
  if (provider) {
    const where = provider.parseLink(target)
    const account = config.accounts.find((a) => a.type === provider.type && (!opts.account || a.id === opts.account))
    return out(await provider.post({ account, ...where, text: LABEL + text }))
  }
  const [entry] = selectSources(config, { project: opts.project, source: target })
  if (!entry?.provider.post) {
    const channels = Object.values(providers).filter((p) => p.parseLink).map((p) => t(`channel.${p.type}.name`)).join(', ')
    throw new Error(t('error.badTarget', { target, channels }))
  }
  out(await entry.provider.post({ account: entry.account, source: entry.source, text: LABEL + text }))
}
