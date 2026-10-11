import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { dirname } from 'node:path'
import { SECRETS_FILE } from './paths.js'

/** Load the secrets file into process.env (existing env vars win). */
export const loadSecrets = (file = SECRETS_FILE) => {
  if (existsSync(file)) process.loadEnvFile(file)
}

export const getSecret = (name) => (name ? process.env[name] : undefined)

/** Set or replace `KEY=value` lines in the secrets file, keeping it private. */
export const saveSecrets = (values, file = SECRETS_FILE) => {
  mkdirSync(dirname(file), { recursive: true })
  const lines = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean) : []
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${JSON.stringify(value)}`
    const index = lines.findIndex((l) => l.startsWith(`${key}=`))
    if (index === -1) lines.push(line)
    else lines[index] = line
    process.env[key] = value
  }
  writeFileSync(file, lines.join('\n') + '\n', { mode: 0o600 })
  chmodSync(file, 0o600)
}

/** Env var name for an account secret, e.g. FEEDBAI_MATRIX_ME_TOKEN. */
export const secretName = (account, field) =>
  `FEEDBAI_${account}_${field}`.toUpperCase().replace(/[^A-Z0-9]+/g, '_')
