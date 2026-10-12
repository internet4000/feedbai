import { findProjectConfig, loadConfig, readConfig, selectSources } from '../config.js'
import { detectProject } from '../project.js'
import { discover } from '../discover.js'
import { collect } from '../feedback.js'
import { formats } from '../format.js'
import { readState, stateKey, consumerName } from '../state.js'
import { t } from '../i18n.js'
import { channelText } from '../providers/index.js'
import { repoStatus } from '../github.js'
import { githubRepo, githubToken } from '../gh.js'
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
    t('home.setup', { id: project.id, root: project.root, channels: channelText('setup', { id: project.id }), logins: channelText('login') }),
    otherProjects(),
  ].filter(Boolean).join('\n\n')
}

const MERGE = ['CLEAN', 'BLOCKED', 'DIRTY', 'BEHIND']

const prState = (pr) =>
  [pr.draft && t('github.draft'), pr.checks && t(`github.checks.${pr.checks}`), pr.review && t(`github.review.${pr.review}`), MERGE.includes(pr.merge) && t(`github.merge.${pr.merge}`)]
    .filter(Boolean)
    .join(' · ')

/** What is already in progress on GitHub, so new feedback is read next to open issues and PRs. */
const githubSection = async () => {
  const repo = githubRepo()
  if (!repo) return ''
  const token = githubToken()
  if (!token) return t('github.noToken')
  try {
    const { issues, pulls } = await repoStatus({ token, repo })
    const list = (kind, { total, items }, line) =>
      items.length ? [t(`github.${kind}`, { count: total }), ...items.map(line), total > items.length && t('github.more', { count: total - items.length, kind: kind === 'pulls' ? 'pr' : 'issue' })] : []
    const lines = [
      ...list('issues', issues, (i) => `- #${i.number} ${i.title}${i.labels.length ? ` [${i.labels.join(', ')}]` : ''}`),
      ...list('pulls', pulls, (p) => `- #${p.number} ${p.title}${prState(p) ? ` — ${prState(p)}` : ''}`),
    ].filter(Boolean)
    return [t('github.title', { repo }), lines.length ? lines.join('\n') : t('github.none')].join('\n\n')
  } catch (error) {
    return t('github.failed', { repo, reason: error.message })
  }
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

  const usable = list.filter((e) => ['ok', 'none', 'hub'].includes(authState(e)))
  const since = opts.since ?? 'last'
  const consumer = consumerName(opts)
  const title = feedbackTitle(usable, since, consumer)
  const [result, github] = await Promise.all([collect(usable, { since, consumer, limit: opts.limit }), githubSection()])
  const found = discover(project.root, list.map((e) => e.source))

  out([
    t('home.title', { project: ids.join(', ') }),
    t('home.config', { file }),
    `${t('home.sources')}\n\n${list.map((e) => `- ${e.source.id} · ${describe(e.source)} — ${authText(e)}`).join('\n')}`,
    found.length && `${t('home.alsoFound')}\n\n${suggestions(found)}`,
    formats.md(result, { title, depth: 3 }).trim(),
    github,
    t('home.next', { consumer }),
  ].filter(Boolean).join('\n\n'))
  if (result.errors.length) process.exitCode = 2
}
