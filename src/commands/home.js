import { findProjectConfig, loadConfig, readConfig, selectSources } from '../config.js'
import { detectProject } from '../project.js'
import { discover } from '../discover.js'
import { collect } from '../feedback.js'
import { formats } from '../format.js'
import { readState, stateKey, consumerName } from '../state.js'
import { t } from '../i18n.js'
import { authState, authText, describe, out } from './shared.js'

const suggestions = (list) => list.map((s) => `- ${s.type} ${s.mode ?? ''} ${s.value} → \`${s.command}\``.replace('  ', ' ')).join('\n')

const otherProjects = () => {
  try {
    const ids = loadConfig().config.projects.map((p) => p.id)
    return ids.length ? t('home.otherProjects', { projects: ids.join(', ') }) : ''
  } catch {
    return ''
  }
}

/** No sources for this project yet: everything an agent needs to set it up with the user. */
const onboarding = (project, file) => {
  const found = discover(project.root)
  return [
    t('home.title', { project: project.id }),
    t(file ? 'home.noSources' : 'home.notSetUp', { root: project.root, file }),
    found.length && `${t('home.found')}\n\n${suggestions(found)}`,
    t('home.setup', { id: project.id, root: project.root }),
    otherProjects(),
  ].filter(Boolean).join('\n\n')
}

/** Title of the feedback section: since when are we showing items? */
const feedbackTitle = (list, since, consumer) => {
  if (since !== 'last') return t('home.feedback.since', { since })
  const state = readState()
  const cursors = list.map((e) => state.sources[stateKey(e.project, e.source, consumer)]).filter(Boolean).sort()
  return cursors.length ? t('home.feedback.new', { since: cursors[0] }) : t('home.feedback.first')
}

export default async ({ opts }) => {
  const file = opts.config ?? findProjectConfig()
  const project = detectProject()
  if (!file) return out(onboarding(project))

  const ids = readConfig(file).projects.map((p) => p.id)
  const list = selectSources(loadConfig({ explicit: opts.config }).config).filter((e) => ids.includes(e.project.id))
  if (!list.length) return out(onboarding(project, file))

  const usable = list.filter((e) => ['ok', 'none'].includes(authState(e)))
  const since = opts.since ?? 'last'
  const consumer = consumerName(opts)
  const title = feedbackTitle(usable, since, consumer)
  const result = await collect(usable, { since, consumer, limit: opts.limit })
  const found = discover(project.root, list.map((e) => e.source))

  out([
    t('home.title', { project: ids.join(', ') }),
    t('home.config', { file }),
    `${t('home.sources')}\n\n${list.map((e) => `- ${e.source.id} · ${describe(e.source)} — ${authText(e)}`).join('\n')}`,
    found.length && `${t('home.alsoFound')}\n\n${suggestions(found)}`,
    formats.md(result, { title, depth: 3, digest: opts.digest }).trim(),
    t('home.next', { consumer }),
  ].filter(Boolean).join('\n\n'))
  if (result.errors.length) process.exitCode = 2
}
