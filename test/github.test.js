import { test } from 'node:test'
import assert from 'node:assert/strict'
import github, { parseRepo } from '../src/providers/github.js'
import { fakeFetch } from './helpers.js'

process.env.TEST_GH_TOKEN = 'ghp_test'
const account = { id: 'g', type: 'github', secrets: { token: 'TEST_GH_TOKEN' } }
const source = { id: 'discussions', type: 'github', repo: 'internet4000/feedbai' }
const node = (id, createdAt, body, extra = {}) => ({ id, url: `https://github.com/x/${id}`, body, createdAt, author: { login: `u-${id}` }, ...extra })

test('parses owner/name and github.com links', () => {
  assert.deepEqual(parseRepo('internet4000/feedbai'), { owner: 'internet4000', name: 'feedbai' })
  assert.deepEqual(parseRepo('https://github.com/internet4000/feedbai/discussions/3'), { owner: 'internet4000', name: 'feedbai' })
  assert.equal(parseRepo('nope'), null)
})

test('discussions become threads: post, comments replying to it, replies to their comment; `since` and token', async () => {
  const discussion = node('D1', '2026-01-01T00:00:00Z', 'body', {
    title: 'Idea',
    updatedAt: '2026-01-03T00:00:00Z',
    comments: { nodes: [node('C1', '2026-01-02T00:00:00Z', 'comment', { replies: { nodes: [node('R1', '2026-01-03T00:00:00Z', 'reply')] } })] },
  })
  const stale = node('D0', '2025-01-01T00:00:00Z', 'old', { title: 'Old', updatedAt: '2025-01-01T00:00:00Z', comments: { nodes: [] } })
  const fetchImpl = fakeFetch([[(u) => u.endsWith('/graphql'), { data: { repository: { discussions: { nodes: [discussion, stale] } } } }]])
  const all = await github.fetch({ project: { id: 'p' }, source, account, limit: 50, fetchImpl })
  assert.deepEqual(all.map((i) => [i.id, i.replyTo, i.thread]), [['D0', undefined, undefined], ['D1', undefined, undefined], ['C1', 'D1', 'D1'], ['R1', 'C1', 'D1']])
  assert.equal(all.find((i) => i.id === 'D1').text, 'Idea\n\nbody')
  assert.equal(fetchImpl.calls[0].init.headers.authorization, 'Bearer ghp_test')
  assert.deepEqual(JSON.parse(fetchImpl.calls[0].init.body).variables, { owner: 'internet4000', name: 'feedbai' })
  const recent = await github.fetch({ project: { id: 'p' }, source, account, since: new Date('2026-01-02'), limit: 50, fetchImpl })
  assert.deepEqual(recent.map((i) => i.id), ['C1', 'R1'])
})

test('needs a token, reports GraphQL errors, never files issues', async () => {
  await assert.rejects(github.fetch({ project: { id: 'p' }, source, account: null, limit: 5 }), /account/)
  const fetchImpl = fakeFetch([[() => true, { errors: [{ message: 'Could not resolve to a Repository' }] }]])
  await assert.rejects(github.fetch({ project: { id: 'p' }, source, account, limit: 5, fetchImpl }), /Could not resolve/)
  assert.equal(github.files(source), false)
  assert.deepEqual(github.add(['discussions', 'https://github.com/a/b']), { repo: 'a/b' })
})

test('repoStatus: open issues and PRs with checks, review and merge state', async () => {
  const { repoStatus } = await import('../src/github.js')
  const pr = { number: 7, title: 'Fix', url: 'u7', isDraft: false, reviewDecision: 'REVIEW_REQUIRED', mergeStateStatus: 'BLOCKED', commits: { nodes: [{ commit: { statusCheckRollup: { state: 'SUCCESS' } } }] } }
  const fetchImpl = fakeFetch([[(u) => u.endsWith('/graphql'), {
    data: { repository: {
      issues: { totalCount: 12, nodes: [{ number: 3, title: 'Bug', url: 'u3', labels: { nodes: [{ name: 'feedback' }] } }] },
      pullRequests: { totalCount: 1, nodes: [pr, { ...pr, number: 8, commits: { nodes: [{ commit: { statusCheckRollup: null } }] } }] },
    } },
  }]])
  const status = await repoStatus({ token: 't', repo: 'a/b', fetchImpl })
  assert.deepEqual(status.issues, { total: 12, items: [{ number: 3, title: 'Bug', url: 'u3', labels: ['feedback'] }] })
  assert.deepEqual(status.pulls.items[0], { number: 7, title: 'Fix', url: 'u7', draft: false, checks: 'SUCCESS', review: 'REVIEW_REQUIRED', merge: 'BLOCKED' })
  assert.equal(status.pulls.items[1].checks, null)
  assert.deepEqual(JSON.parse(fetchImpl.calls[0].init.body).variables, { owner: 'a', name: 'b' })
})
