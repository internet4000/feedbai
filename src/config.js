import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { GLOBAL_CONFIG, PROJECT_CONFIG_NAME } from './paths.js'
import { providers } from './providers/index.js'
import { t } from './i18n.js'

const DEFAULT_LIMIT = 50

/** Walk up from `cwd` to find the nearest project config file. */
export const findProjectConfig = (cwd = process.cwd()) => {
  let dir = resolve(cwd)
  while (true) {
    const file = join(dir, PROJECT_CONFIG_NAME)
    if (existsSync(file)) return file
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export const readConfig = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new Error(t('error.invalidConfig', { file, reason: error.message }))
  }
}

export const emptyConfig = () => ({ accounts: [], projects: [] })

/** Merge configs; later ones win on matching ids. */
export const mergeConfigs = (...configs) => {
  const merged = emptyConfig()
  const byId = (list, item) => list.findIndex((x) => x.id === item.id)
  for (const config of configs) {
    for (const account of config.accounts ?? []) {
      const i = byId(merged.accounts, account)
      i === -1 ? merged.accounts.push(account) : (merged.accounts[i] = account)
    }
    for (const project of config.projects ?? []) {
      const i = byId(merged.projects, project)
      if (i === -1) {
        merged.projects.push({ ...project, sources: [...(project.sources ?? [])] })
        continue
      }
      const target = merged.projects[i]
      const sources = [...target.sources]
      for (const source of project.sources ?? []) {
        const j = byId(sources, source)
        j === -1 ? sources.push(source) : (sources[j] = source)
      }
      merged.projects[i] = { ...target, ...project, sources }
    }
  }
  return merged
}

/** Load the global config and the nearest project config (or `explicit` instead of the latter). */
export const loadConfig = ({ explicit, cwd } = {}) => {
  const files = [GLOBAL_CONFIG, explicit ?? findProjectConfig(cwd)].filter((f) => f && existsSync(f))
  if (!files.length) {
    throw new Error(t('error.noConfig', { project: PROJECT_CONFIG_NAME, global: GLOBAL_CONFIG }))
  }
  return { config: mergeConfigs(...files.map(readConfig)), files }
}

/** Accounts from the environment (CI, the hub): each provider's `envAccount`, e.g. FEEDBAI_MATRIX_TOKEN. */
const envAccounts = (env = process.env) => Object.values(providers).map((p) => p.envAccount?.(env)).filter(Boolean)

/** Pick the account for a source: explicit `account` id, else the first of its type (config, then environment). */
const resolveAccount = (config, source) => {
  if (source.account) {
    const account = config.accounts.find((a) => a.id === source.account)
    if (!account) throw new Error(t('error.unknownAccount', { source: source.id, account: source.account }))
    return account
  }
  return [...config.accounts, ...envAccounts()].find((a) => a.type === source.type) ?? null
}

/** Flatten projects into validated, filtered source entries. */
export const selectSources = (config, { project, source } = {}) =>
  config.projects
    .filter((p) => !project || p.id === project)
    .flatMap((p) =>
      p.sources
        .filter((s) => !source || s.id === source)
        .map((s) => {
          const provider = providers[s.type]
          if (!provider) throw new Error(t('error.unknownType', { type: s.type, source: s.id }))
          provider.validate(s)
          return {
            project: p,
            source: { limit: DEFAULT_LIMIT, ...s },
            account: resolveAccount(config, s),
            provider,
          }
        }),
    )

/** Insert or replace an account in a config file on disk. */
export const upsertAccount = (file, account) => {
  const config = existsSync(file) ? readConfig(file) : emptyConfig()
  config.accounts = (config.accounts ?? []).filter((a) => a.id !== account.id).concat(account)
  config.projects ??= []
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(config, null, 2) + '\n')
}
