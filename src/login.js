import { providers } from './providers/index.js'
import { upsertAccount } from './config.js'
import { saveSecrets, secretName } from './secrets.js'
import { promptHidden } from './prompt.js'
import { GLOBAL_CONFIG, SECRETS_FILE } from './paths.js'
import { t } from './i18n.js'

/** Accounts are personal: they always go to the global config, secrets to the secrets file. */
const save = (account, secrets) => {
  const refs = {}
  const values = {}
  for (const [field, value] of Object.entries(secrets)) {
    refs[field] = secretName(account.id, field)
    values[refs[field]] = value
  }
  saveSecrets(values)
  upsertAccount(GLOBAL_CONFIG, { ...account, secrets: refs })
  return t('login.saved', { account: account.id, config: GLOBAL_CONFIG, secrets: SECRETS_FILE })
}

/** `feedbai login <type> …`: the provider's `authenticate` verifies the secret; feedbai saves it. */
export const login = async (type, opts) => {
  const provider = providers[type]
  if (!provider?.authenticate) throw new Error(t('error.unknownCommand', { command: `login ${type ?? ''}` }))
  const { account, secrets } = await provider.authenticate(opts, { promptHidden })
  return save(account, secrets)
}
