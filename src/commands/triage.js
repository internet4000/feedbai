import { readFileSync } from 'node:fs'
import { collect } from '../feedback.js'
import { fileChosen } from '../issues.js'
import { githubClient } from '../github.js'
import { githubRepo, githubToken } from '../gh.js'
import { loadConfig } from '../config.js'
import { detectProject } from '../project.js'
import { providers } from '../providers/index.js'
import { reactViaHub } from '../hub.js'
import { triageModel, readGuidelines, triageMessages, askModel, checkPlan, itemsOf } from '../triage.js'
import { t } from '../i18n.js'
import { entries, out } from './shared.js'

/**
 * `feedbai triage`: a model proposes, plain code acts. Two steps, so they can run with different powers
 * (e.g. separate CI jobs: the one with the model has no secrets, the one with tokens has no model):
 *
 *   feedbai triage [--input feedback.json] > plan.json   # plan: needs a model, no channel or GitHub tokens
 *   feedbai triage --apply plan.json                     # act: files issues and reacts ✅, no model
 */
export default async ({ opts }) => {
  if (opts.apply) return apply(opts)

  const model = triageModel()
  if (!model) throw new Error(t('triage.noModel'))
  const result = opts.input ? JSON.parse(readFileSync(opts.input, 'utf8')) : await collect(entries(opts), { since: opts.since ?? '1d', limit: opts.limit })
  const items = itemsOf(result)
  if (!items.length) return out(JSON.stringify({ kinds: [], file: [], react: [], dropped: 0 }, null, 2))
  const raw = await askModel({ model, messages: triageMessages({ items, guidelines: readGuidelines(detectProject().root) }) })
  const plan = checkPlan(raw, items)
  process.stderr.write(t('triage.summary', { items: items.length, issues: plan.file.length, dropped: plan.dropped, model: model.model }) + '\n')
  out(JSON.stringify({ model: model.model, at: new Date().toISOString(), ...plan }, null, 2))
}

/** Act on a checked plan: plain code, no model. Re-checks the plan's shape: a plan file is input too. */
const apply = async (opts) => {
  const plan = JSON.parse(readFileSync(opts.apply, 'utf8'))
  const token = githubToken()
  const repo = githubRepo()
  if (!token || !repo) throw new Error(t('error.noGithub'))
  const client = githubClient({ token, repo })
  const sources = entries(opts)
  const urls = []
  const filed = new Set()
  for (const issue of (Array.isArray(plan.file) ? plan.file : []).slice(0, 5)) {
    if (!Array.isArray(issue.links) || !issue.links.length || typeof issue.title !== 'string') continue
    const { url, missing, errors } = await fileChosen({ entries: sources, client, links: issue.links, title: issue.title, note: issue.note ?? '', since: opts.since ?? '7d' })
    for (const e of errors) process.stderr.write(e.error + '\n')
    if (missing.length) process.stderr.write(t('file.missing', { links: missing.join(' '), since: opts.since ?? '7d' }) + '\n')
    if (url) {
      urls.push(url)
      for (const link of issue.links) filed.add(link)
    }
  }
  const { config } = loadConfig({ explicit: opts.config })
  // ✅ only on messages that were just filed: a plan file can't make the agent react elsewhere
  for (const link of (Array.isArray(plan.react) ? plan.react : []).filter((l) => filed.has(l))) {
    const provider = Object.values(providers).find((p) => p.react && p.parseLink?.(link))
    // In CI the agent's account comes from the environment (FEEDBAI_MATRIX_TOKEN…), only in the act job
    const account = provider && (config.accounts.find((a) => a.type === provider.type) ?? provider.envAccount?.(process.env))
    if (!provider) continue
    // No account of its own (e.g. a GitHub Actions run with no secrets): the hub's bot ✅s for this repository
    const react = account ? provider.react({ account, ...provider.parseLink(link) }) : provider.type === 'matrix' ? reactViaHub({ link }) : null
    await react?.catch((error) => process.stderr.write(`${link}: ${error.message}\n`))
  }
  out(urls.length ? urls.join('\n') : t('issues.none'))
}
