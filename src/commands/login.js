import { logins } from '../login.js'
import { t } from '../i18n.js'

export default async ({ opts, args }) => {
  const login = logins[args[0]]
  if (!login) throw new Error(t('error.unknownCommand', { command: `login ${args[0] ?? ''}` }))
  process.stderr.write((await login(opts)) + '\n')
}
