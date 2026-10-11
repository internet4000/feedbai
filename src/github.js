import { request } from './http.js'

const API = 'https://api.github.com'
const PER_PAGE = 100

/** Minimal GitHub REST client over fetch: runs anywhere (Node, Actions, Workers, Lambda). */
export const githubClient = ({ token, repo, fetchImpl }) => {
  const call = (path, options = {}) => request(`${API}${path}`, { token, fetchImpl, ...options })
  const all = async (path) => {
    const items = []
    for (let page = 1; ; page++) {
      const batch = await call(`${path}${path.includes('?') ? '&' : '?'}per_page=${PER_PAGE}&page=${page}`)
      items.push(...batch)
      if (batch.length < PER_PAGE) return items
    }
  }
  return {
    repo,
    issues: (label) => all(`/repos/${repo}/issues?labels=${encodeURIComponent(label)}&state=all`),
    comments: () => all(`/repos/${repo}/issues/comments`),
    createIssue: ({ title, body, labels }) => call(`/repos/${repo}/issues`, { method: 'POST', body: { title, body, labels } }),
    comment: (number, body) => call(`/repos/${repo}/issues/${number}/comments`, { method: 'POST', body: { body } }),
    ensureLabel: ({ name, color, description }) =>
      call(`/repos/${repo}/labels`, { method: 'POST', body: { name, color, description } }).catch((error) => {
        if (error.status !== 422) throw error // 422: already exists
      }),
  }
}
