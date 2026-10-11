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

const matrix = async ({ homeserver = 'https://matrix.org', user, token: useToken, account }) => {
  const provider = providers.matrix
  let token
  if (useToken) {
    token = await promptHidden(t('prompt.token', { user: user ?? homeserver }))
    user = await provider.whoami({ homeserver, token })
  } else {
    if (!user) throw new Error(t('error.missingField', { source: 'login', field: '--user' }))
    const password = await promptHidden(t('prompt.password', { user }))
    ;({ token, user } = await provider.login({ homeserver, user, password }))
  }
  return save({ id: account ?? `matrix-${user}`, type: 'matrix', homeserver, user }, { token })
}

const bluesky = async ({ service = 'https://bsky.social', identifier, account }) => {
  if (!identifier) throw new Error(t('error.missingField', { source: 'login', field: '--identifier' }))
  const password = await promptHidden(t('prompt.appPassword', { identifier }))
  const { handle } = await providers.bluesky.login({ service, identifier, password })
  return save({ id: account ?? `bluesky-${handle}`, type: 'bluesky', service, identifier: handle }, { password })
}

export const logins = { matrix, bluesky }
