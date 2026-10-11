import { authState, authText, describe, entries, out } from './shared.js'

export default ({ opts }) => {
  const list = entries(opts)
  if (opts.format !== 'md') {
    const rows = list.map((e) => ({ project: e.project.id, ...e.source, account: e.account?.id, auth: authState(e) }))
    return out(JSON.stringify(rows, null, 2))
  }
  out(list.map((e) => `- ${e.project.id}/${e.source.id} · ${describe(e.source)} — ${authText(e)}`).join('\n'))
}
