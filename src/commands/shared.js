import { loadConfig, selectSources } from '../config.js'
import { t } from '../i18n.js'

export const out = (text) => process.stdout.write(text.endsWith('\n') ? text : text + '\n')

export const entries = (opts, filter = {}) => {
  const { config } = loadConfig({ explicit: opts.config })
  const selected = selectSources(config, { ...opts, ...filter })
  if (!selected.length) throw new Error(t('error.noSources'))
  return selected
}

/** "bluesky search radio4000" */
export const describe = (source) =>
  [source.type, source.mode, source.room ?? source.query ?? source.actor ?? source.post].filter(Boolean).join(' ')

/** auth state: ok | none (not needed) | hub (read through the feedbai hub) | login (needs an account) | missing (account without secret) */
export const authState = ({ source, account, provider }) => {
  const status = provider.authStatus(account)
  if (status !== 'none') return status
  if (!provider.needsAuth(source)) return 'none'
  return provider.viaHub?.(source) ? 'hub' : 'login'
}

export const authText = (entry) =>
  t(`auth.${authState(entry)}`, {
    account: entry.account?.id,
    command: t(`login.hint.${entry.source.type}`),
  })
