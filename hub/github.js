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

/** Every repository the App is installed on, with a short-lived token scoped to its installation. */
export const installedRepos = async ({ appId, privateKey, fetchImpl }) => {
  const jwt = appJwt(appId, privateKey)
  const installations = await gh('/app/installations?per_page=100', jwt, { fetchImpl })
  const repos = []
  for (const installation of installations) {
    const { token } = await gh(`/app/installations/${installation.id}/access_tokens`, jwt, { method: 'POST', fetchImpl })
    const { repositories } = await gh('/installation/repositories?per_page=100', token, { fetchImpl })
    for (const repo of repositories) repos.push({ fullName: repo.full_name, token })
  }
  return repos
}

/** The repo's feedbai.config.json (default branch), or null. */
export const repoConfig = async ({ fullName, token, fetchImpl }) => {
  try {
    const file = await gh(`/repos/${fullName}/contents/feedbai.config.json`, token, { fetchImpl })
    return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'))
  } catch (error) {
    if (error.status === 404) return null
    throw error
  }
}
