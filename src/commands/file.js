import { fileChosen } from '../issues.js'
import { githubClient } from '../github.js'
import { githubRepo, githubToken } from '../gh.js'
import { t } from '../i18n.js'
import { entries, out } from './shared.js'

/**
 * `feedbai file <message link…> --title "…" [--note "…"]`: the agent decides what becomes an issue.
 * One issue for the chosen messages, in feedbai's format (so duplicates are caught and "This is fixed"
 * goes back to them). Already-filed messages are added to their issue instead.
 */
export default async ({ opts, args }) => {
  if (!args.length || !opts.title) throw new Error(t('error.missingField', { source: 'file', field: '<message link…> --title "…"' }))
  const token = githubToken()
  const repo = githubRepo()
  if (!token || !repo) throw new Error(t('error.noGithub'))
  const { action, url, missing, errors } = await fileChosen({
    entries: entries(opts),
    client: githubClient({ token, repo }),
    links: args,
    title: opts.title,
    note: opts.note,
    since: opts.since ?? '30d',
    dryRun: opts['dry-run'],
  })
  for (const e of errors) process.stderr.write(e.error + '\n')
  if (missing.length) process.stderr.write(t('file.missing', { links: missing.join(' '), since: opts.since ?? '30d' }) + '\n')
  if (!action) {
    process.exitCode = 1
    return
  }
  if (opts['dry-run']) return out(`--- ${action.type} ${action.title ?? `#${action.issue}`}\n${action.body ?? ''}`)
  out(action.type === 'existing' ? t('file.existing', { url }) : url)
}
