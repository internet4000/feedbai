import { execFileSync } from 'node:child_process'
import { fileIssues } from '../issues.js'
import { githubClient } from '../github.js'
import { detectProject } from '../project.js'
import { t } from '../i18n.js'
import { entries, out } from './shared.js'

/** Token from the environment (CI), else from an installed `gh` login. */
const githubToken = () => {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

/** owner/repo from GH_REPO, GITHUB_REPOSITORY (Actions) or the git remote. */
const githubRepo = () =>
  process.env.GH_REPO ||
  process.env.GITHUB_REPOSITORY ||
  detectProject().repository?.match(/github\.com\/([^/]+\/[^/]+)/)?.[1]

/** `feedbai issues`: file feedback as GitHub issues in this repo. */
export default async ({ opts }) => {
  const token = githubToken()
  const repo = githubRepo()
  if (!token || !repo) throw new Error(t('error.noGithub'))
  const { actions, urls, errors } = await fileIssues({
    entries: entries(opts),
    client: githubClient({ token, repo }),
    since: opts.since,
    limit: opts.limit,
    dryRun: opts['dry-run'],
  })
  if (opts['dry-run']) {
    out(actions.length ? actions.map((a) => `--- ${a.type} ${a.title ?? `#${a.issue}`}\n${a.body}`).join('\n\n') : t('issues.none'))
  } else {
    out(urls.length ? urls.join('\n') : t('issues.none'))
  }
  for (const e of errors) process.stderr.write(e.error + '\n')
  if (errors.length) process.exitCode = 2
}
