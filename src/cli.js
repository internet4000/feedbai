#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { loadSecrets } from './secrets.js'
import { commands } from './commands/index.js'
import { t } from './i18n.js'

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    project: { type: 'string' },
    source: { type: 'string' },
    since: { type: 'string' },
    limit: { type: 'string' },
    format: { type: 'string', default: 'md' },
    as: { type: 'string' },
    interval: { type: 'string' },
    'dry-run': { type: 'boolean' },
    config: { type: 'string' },
    id: { type: 'string' },
    join: { type: 'boolean' },
    homeserver: { type: 'string' },
    user: { type: 'string' },
    token: { type: 'boolean' },
    identifier: { type: 'string' },
    service: { type: 'string' },
    account: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
})

const main = async () => {
  const [name = 'home', ...args] = opts.help ? ['help'] : positionals
  const command = commands[name]
  if (!command) throw new Error(t('error.unknownCommand', { command: name }))
  loadSecrets()
  await command({ opts, args })
}

main().catch((error) => {
  process.stderr.write(`feedbai: ${error.message}\n`)
  process.exitCode = 1
})
