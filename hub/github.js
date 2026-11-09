import { createSign } from 'node:crypto'
import { request } from '../src/http.js'

const API = 'https://api.github.com'

const b64url = (data) => Buffer.from(data).toString('base64url')

/** Short-lived JWT identifying the GitHub App (RS256). */
export const appJwt = (appId, privateKey, now = Math.floor(Date.now() / 1000)) => {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: String(appId) }))
  const signature = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey, 'base64url')
  return `${head}.${body}.${signature}`
}

const gh = (path, token, { method = 'GET', fetchImpl } = {}) =>
  request(`${API}${path}`, { method, fetchImpl, token })

/**
 * Every repository the App is installed on, with a short-lived token scoped to its installation.
 * `only` (an invite-only hub's listed "owner/name", lowercase): no token is even minted for an installation
 * whose account owns none of them.
 */
export const installedRepos = async ({ appId, privateKey, fetchImpl, only = null }) => {
  const jwt = appJwt(appId, privateKey)
  const installations = await gh('/app/installations?per_page=100', jwt, { fetchImpl })
  const owners = only && new Set(only.map((repo) => repo.split('/')[0]))
  const repos = []
  for (const installation of installations) {
    if (owners && !owners.has(String(installation.account?.login).toLowerCase())) continue
    const { token } = await gh(`/app/installations/${installation.id}/access_tokens`, jwt, { method: 'POST', fetchImpl })
    const { repositories } = await gh('/installation/repositories?per_page=100', token, { fetchImpl })
    for (const repo of repositories) repos.push({ fullName: repo.full_name, private: repo.private, token })
  }
  return repos
}

/**
 * The repo's feedbai.config.json (default branch), or null. The only file the hub reads: its App asks for
 * "Single file: read" on that path, never the repository's contents.
 */
export const repoConfig = async ({ fullName, token, fetchImpl }) => {
  try {
    const file = await gh(`/repos/${fullName}/contents/feedbai.config.json`, token, { fetchImpl })
    return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'))
  } catch (error) {
    if (error.status === 404) return null
    if (error.status === 403)
      throw new Error(
        `can't read feedbai.config.json: the GitHub App needs "Single file: read" on the path feedbai.config.json (App settings → Permissions & events → Repository permissions → Single file), and the installation must accept it (org settings → GitHub Apps → Review request)`,
      )
    throw error
  }
}
