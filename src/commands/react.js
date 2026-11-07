import { loadConfig } from '../config.js'
import { providers } from '../providers/index.js'
import { t } from '../i18n.js'
import { out } from './shared.js'

/**
 * `feedbai react <message link> [emoji]` (default ✅): tell the person their message was seen and is being
 * handled, without adding a message to the conversation. Matrix for now.
 */
export default async ({ opts, args }) => {
  const [target, key = '✅'] = args
  const provider = target && Object.values(providers).find((p) => p.react && p.parseLink?.(target))
  if (!provider) {
    const channels = Object.values(providers).filter((p) => p.react).map((p) => t(`channel.${p.type}.name`)).join(', ')
    throw new Error(t('error.badReactTarget', { target: target ?? '', channels }))
  }
  const { config } = loadConfig({ explicit: opts.config })
  const account = config.accounts.find((a) => a.type === provider.type && (!opts.account || a.id === opts.account))
  out(await provider.react({ account, ...provider.parseLink(target), key }))
}
