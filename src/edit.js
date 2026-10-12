import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { findProjectConfig, readConfig } from './config.js'
import { detectProject } from './project.js'
import { providers } from './providers/index.js'
import { PROJECT_CONFIG_NAME } from './paths.js'
import { t } from './i18n.js'

export const SCHEMA_URL = 'https://raw.githubusercontent.com/internet4000/feedbai/main/schemas/config.schema.json'

const write = (file, config) => writeFileSync(file, JSON.stringify(config, null, 2) + '\n')

/** Create feedbai.config.json at the project root, with inferred project metadata. */
export const initConfig = ({ cwd } = {}) => {
  const existing = findProjectConfig(cwd)
  const detected = detectProject(cwd)
  const file = join(detected.root, PROJECT_CONFIG_NAME)
  if (existing ?? existsSync(file)) throw new Error(t('error.configExists', { file: existing ?? file }))
  const project = {
    id: detected.id,
    ...(detected.repository && { repository: detected.repository }),
    sources: [],
  }
  write(file, { $schema: SCHEMA_URL, projects: [project] })
  return file
}

const openConfig = ({ cwd, create }) => {
  const file = findProjectConfig(cwd) ?? (create ? initConfig({ cwd }) : null)
  if (!file) throw new Error(t('error.noProjectConfig'))
  return { file, config: readConfig(file) }
}

const pickProject = (config, id) => {
  const project = id ? config.projects.find((p) => p.id === id) : config.projects[0]
  if (!project) throw new Error(t('error.noProject', { project: id ?? '' }))
  return project
}

const uniqueId = (sources, base) => {
  const ids = new Set(sources.map((s) => s.id))
  let id = base
  for (let n = 2; ids.has(id); n++) id = `${base}-${n}`
  return id
}

/** `feedbai add <type> …words`: the provider's `add` builds the source from the words. */
export const addSource = ({ cwd, words, opts }) => {
  const [type, ...rest] = words
  const provider = providers[type]
  if (!provider?.add) throw new Error(t('error.unknownType', { type: type ?? '', source: '(add)' }))
  const { file, config } = openConfig({ cwd, create: true })
  const project = pickProject(config, opts.project)
  const draft = { type, ...provider.add(rest, opts) }
  const source = {
    id: opts.id ?? uniqueId(project.sources, [type, draft.mode].filter(Boolean).join('-')),
    ...draft,
    ...(opts.account && { account: opts.account }),
    ...(opts.limit && { limit: Number(opts.limit) }),
  }
  providers[type].validate(source)
  if (project.sources.some((s) => s.id === source.id)) throw new Error(t('error.sourceExists', { source: source.id }))
  project.sources.push(source)
  write(file, config)
  return { file, project, source }
}

export const removeSource = ({ cwd, id, opts }) => {
  const { file, config } = openConfig({ cwd, create: false })
  const project = pickProject(config, opts.project)
  const before = project.sources.length
  project.sources = project.sources.filter((s) => s.id !== id)
  if (project.sources.length === before) throw new Error(t('error.noSources'))
  write(file, config)
  return { file, project }
}
