import { collect } from '../feedback.js'
import { applyIssues, ensureLabel, gh, indexIssues, planIssues } from '../issues.js'
import { t } from '../i18n.js'
import { entries, out } from './shared.js'

/** `feedbai issues`: file feedback as GitHub issues in the current repo (needs `gh`). */
export default async ({ opts }) => {
  const { groups, errors } = await collect(entries(opts), { since: opts.since ?? '1d', limit: opts.limit })
  const items = groups.flatMap((g) => g.items).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const actions = planIssues(items, indexIssues(gh))
  if (opts['dry-run']) {
    out(actions.length ? actions.map((a) => `--- ${a.type} ${a.title ?? `#${a.issue}`}\n${a.body}`).join('\n\n') : t('issues.none'))
  } else {
    if (actions.length) ensureLabel(gh)
    const urls = applyIssues(actions, gh)
    out(urls.length ? urls.join('\n') : t('issues.none'))
  }
  for (const e of errors) process.stderr.write(e.error + '\n')
  if (errors.length) process.exitCode = 2
}
