#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { loadConfig, selectSources, findProjectConfig } from './config.js'
import { loadSecrets } from './secrets.js'
import { collect } from './feedback.js'
import { formats } from './format.js'
import { logins } from './login.js'
import { GLOBAL_CONFIG, SECRETS_FILE, STATE_FILE } from './paths.js'
import { t } from './i18n.js'

const { values: opts, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    project: { type: 'string' },
    source: { type: 'string' },
    since: { type: 'string' },
    limit: { type: 'string' },
    format: { type: 'string', default: 'md' },
    config: { type: 'string' },
    homeserver: { type: 'string' },
    user: { type: 'string' },
    token: { type: 'boolean' },
    identifier: { type: 'string' },
    service: { type: 'string' },
    account: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
})

const out = (text) => process.stdout.write(text)

const entries = () => {
  const { config } = loadConfig({ explicit: opts.config })
  const selected = selectSources(config, opts)
  if (!selected.length) throw new Error(t('error.noSources'))
  return selected
}

const commands = {
  async fetch() {
    if (!formats[opts.format]) throw new Error(t('error.unknownCommand', { command: `--format ${opts.format}` }))
    const result = await collect(entries(), { since: opts.since, limit: opts.limit })
    out(formats[opts.format](result))
    if (result.errors.length) process.exitCode = 2
  },

  sources() {
    const list = entries().map(({ project, source, account, provider }) => {
      const status = provider.authStatus(account)
      return {
        project: project.id,
        repository: project.repository,
        ...source,
        auth: t(`sources.auth.${status}`, { account: account?.id }),
      }
    })
    out(opts.format === 'md'
      ? list.map((s) => `- ${s.project}/${s.id} [${s.type}${s.mode ? `:${s.mode}` : ''}] ${s.room ?? s.query ?? s.actor ?? s.post ?? ''} — ${s.auth}`).join('\n') + '\n'
      : JSON.stringify(list, null, 2) + '\n')
  },

  async login() {
    const login = logins[positionals[1]]
    if (!login) throw new Error(t('error.unknownCommand', { command: `login ${positionals[1] ?? ''}` }))
    process.stderr.write(await login(opts) + '\n')
  },

  paths() {
    out(JSON.stringify({ global: GLOBAL_CONFIG, project: findProjectConfig(), secrets: SECRETS_FILE, state: STATE_FILE }, null, 2) + '\n')
  },
}

const main = async () => {
  const command = commands[positionals[0]]
  if (opts.help || !positionals[0]) return out(t('usage'))
  if (!command) throw new Error(t('error.unknownCommand', { command: positionals[0] }))
  loadSecrets()
  await command()
}

main().catch((error) => {
  process.stderr.write(`feedbai: ${error.message}\n`)
  process.exitCode = 1
})
