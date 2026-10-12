import { fileIssues } from '../issues.js'
import { githubClient } from '../github.js'
import { githubRepo, githubToken } from '../gh.js'
import { t } from '../i18n.js'
import { entries, out } from './shared.js'

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
