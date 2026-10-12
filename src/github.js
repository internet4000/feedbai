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

const STATUS = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    issues(states: OPEN, first: 10, orderBy: { field: UPDATED_AT, direction: DESC }) {
      totalCount
      nodes { number title url labels(first: 5) { nodes { name } } }
    }
    pullRequests(states: OPEN, first: 10, orderBy: { field: UPDATED_AT, direction: DESC }) {
      totalCount
      nodes {
        number title url isDraft reviewDecision mergeStateStatus
        commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }
      }
    }
  }
}`

/**
 * Open issues and pull requests of `repo` (owner/name), with each PR's checks, review and
 * merge state: what is already in progress, next to the new feedback.
 */
export const repoStatus = async ({ token, repo, fetchImpl }) => {
  const [owner, name] = repo.split('/')
  const { data, errors } = await request(`${API}/graphql`, { method: 'POST', token, fetchImpl, body: { query: STATUS, variables: { owner, name } } })
  if (errors?.length) throw new Error(errors.map((e) => e.message).join('; '))
  const { issues, pullRequests } = data.repository
  return {
    issues: {
      total: issues.totalCount,
      items: issues.nodes.map((i) => ({ number: i.number, title: i.title, url: i.url, labels: i.labels.nodes.map((l) => l.name) })),
    },
    pulls: {
      total: pullRequests.totalCount,
      items: pullRequests.nodes.map((p) => ({
        number: p.number,
        title: p.title,
        url: p.url,
        draft: p.isDraft,
        checks: p.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null, // SUCCESS | FAILURE | ERROR | PENDING | EXPECTED
        review: p.reviewDecision, // APPROVED | CHANGES_REQUESTED | REVIEW_REQUIRED | null
        merge: p.mergeStateStatus, // CLEAN | BLOCKED | DIRTY (conflicts) | BEHIND | UNSTABLE | DRAFT | UNKNOWN
      })),
    },
  }
}
