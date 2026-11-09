/**
 * GET /v1/ecosystem: the projects that chose to be listed (`"listed": true` in their public repository's
 * feedbai.config.json, with the GitHub App installed), and how their loop went in the last 30 days: feedback
 * issues filed, fixed, still open. Numbers and links only, never what people wrote. Nothing stored: read from
 * GitHub when asked, cached 10 minutes.
 */
import { request } from '../src/http.js'
import { installedRepos, repoConfig } from './github.js'
import { LABEL } from '../src/issues.js'
import { projectUri } from '../src/links.js'

const DAYS = 30
const MAX_PAGES = 3 // 300 feedback issues touched in a month per project is plenty for a count

/** Channel kinds a project listens to (no room names or queries: the dashboard only says where). */
const channels = (sources = []) => [...new Set(sources.map((s) => s.type))].sort()

/** Feedback issues filed / fixed in the window, and open now, from the repository's `feedback` label. */
export const loopCounts = async ({ fullName, token, now = Date.now(), fetchImpl }) => {
  const from = now - DAYS * 86400000
  const since = new Date(from).toISOString()
  let filed = 0
  let fixed = 0
  let open = 0
  for (let page = 1; page <= MAX_PAGES; page++) {
    const issues = await request(`https://api.github.com/repos/${fullName}/issues?labels=${LABEL}&state=all&since=${since}&per_page=100&page=${page}`, { token, fetchImpl })
    for (const issue of issues) {
      if (issue.pull_request) continue
      if (Date.parse(issue.created_at) >= from) filed++
      if (issue.state === 'open') open++
      else if (issue.state_reason !== 'not_planned' && Date.parse(issue.closed_at) >= from) fixed++
    }
    if (issues.length < 100) break
  }
  return { filed, fixed, open }
}

export const ecosystem = async ({ env, now, fetchImpl }) => {
  const repos = await installedRepos({ appId: env.FEEDBAI_APP_ID, privateKey: env.FEEDBAI_APP_PRIVATE_KEY, fetchImpl })
  const projects = []
  for (const repo of repos.filter((r) => !r.private)) {
    const config = await repoConfig({ ...repo, fetchImpl }).catch(() => null)
    const uri = projectUri(repo.fullName)
    const same = (value) => projectUri(value ?? '')?.toLowerCase() === uri.toLowerCase()
    // Listed only by a project of this repository's own config: a repo can't list someone else
    for (const project of config?.projects ?? []) {
      if (project.listed !== true || !same(project.repository)) continue
      projects.push({ id: String(project.id).slice(0, 60), repository: uri, channels: channels(project.sources), ...(await loopCounts({ ...repo, now, fetchImpl })) })
    }
  }
  projects.sort((a, b) => b.filed - a.filed || a.id.localeCompare(b.id))
  return { days: DAYS, projects, updated: new Date(now ?? Date.now()).toISOString() }
}

export const readEcosystem = async ({ env, fetchImpl }) => {
  const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*' }
  if (!env.FEEDBAI_APP_ID || !env.FEEDBAI_APP_PRIVATE_KEY) return new Response(JSON.stringify({ days: DAYS, projects: [] }), { headers })
  try {
    return new Response(JSON.stringify(await ecosystem({ env, fetchImpl })), { headers: { ...headers, 'cache-control': 'public, max-age=600' } })
  } catch {
    return new Response(JSON.stringify({ error: 'GitHub is unreachable, try again later' }), { status: 502, headers })
  }
}
