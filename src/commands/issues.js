import { collect } from '../feedback.js'
import { withRoles } from '../roles.js'
import { applyIssues, ensureLabel, gh, indexIssues, planIssues } from '../issues.js'
import { t } from '../i18n.js'
import { entries, out } from './shared.js'

/** Mentions that reply to older messages get those messages too, so issues are self-contained. */
const withContext = async (items, list) => {
  const ids = new Set(items.map((entry) => entry.id))
  for (const entry of items.filter((e) => e.toSelf && e.replyTo && !ids.has(e.replyTo))) {
    const from = list.find((e) => e.project.id === entry.project && e.source.id === entry.source)
    const chain = (await from?.provider.ancestors?.({ ...from, entry })) ?? []
    for (const parent of withRoles(chain, from)) if (!ids.has(parent.id)) ids.add(parent.id) && items.push(parent)
  }
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** `feedbai issues`: file feedback as GitHub issues in the current repo (needs `gh`). */
export default async ({ opts }) => {
  const list = entries(opts)
  const { groups, errors } = await collect(list, { since: opts.since ?? '1d', limit: opts.limit })
  const items = await withContext(groups.flatMap((g) => g.items), list)
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
