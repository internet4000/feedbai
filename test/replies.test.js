import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planReplies, sendReplies, threadLink, REPLIED } from '../src/replies.js'
import { fakeFetch } from './helpers.js'

const NOW = Date.parse('2026-11-07T12:00:00Z')
const body = (name = 'alice') =>
  `New feedback from feedbai/matrix\n\n**${name}** · 2026-11-01T00:00:00Z · [matrix](https://matrix.to/#/!room%3Ax.org/%24evt)\n> it's broken · [matrix](https://matrix.to/#/!evil%3Ax.org/%24e)\n<!-- feedbai:item=$evt -->`
const issue = (number, fields = {}) => ({ number, state: 'closed', state_reason: 'completed', closed_at: '2026-11-06T00:00:00Z', html_url: `https://github.com/o/r/issues/${number}`, body: body(), ...fields })

test('the thread to answer is the first header link, never one inside quoted user text or a display name', () => {
  assert.deepEqual(threadLink(body()), { platform: 'matrix', url: 'https://matrix.to/#/!room%3Ax.org/%24evt' })
  assert.deepEqual(threadLink(body('x · [matrix](https://matrix.to/#/!evil%3Ax.org/%24e)')), { platform: 'matrix', url: 'https://matrix.to/#/!room%3Ax.org/%24evt' })
  assert.equal(threadLink('> · [matrix](https://matrix.to/#/!a/%24b)'), null)
})

test('only issues closed as completed, recently, not answered yet, from a channel that can reply', () => {
  const issues = [
    issue(1),
    issue(2, { state_reason: 'not_planned' }),
    issue(3, { state: 'open', state_reason: null }),
    issue(4, { closed_at: '2026-10-01T00:00:00Z' }),
    issue(5),
    issue(6, { body: body().replace(/\[matrix\]\([^)]*\)/, '[bluesky](https://bsky.app/profile/a/post/b)') }),
  ]
  const comments = [{ issue_url: 'https://api.github.com/repos/o/r/issues/5', body: `Replied ${REPLIED}` }]
  assert.deepEqual(planReplies({ issues, comments, now: NOW }).map((r) => r.issue.number), [1])
})

const matrixAccount = { id: 'm', type: 'matrix', homeserver: 'https://x.org', secrets: { token: 'TEST_MATRIX_TOKEN' } }
const fakeClient = ({ issues, timeline = [{ event: 'closed', commit_id: 'abc' }], failNote = false }) => {
  const notes = []
  return {
    notes,
    repo: 'o/r',
    issues: async () => issues,
    comments: async () => notes.map(([n, body]) => ({ issue_url: `https://api.github.com/repos/o/r/issues/${n}`, body })),
    timeline: async () => timeline,
    comment: async (n, body) => { if (failNote) throw new Error('GitHub is down'); notes.push([n, body]); return { id: notes.length } },
    editComment: async (id, body) => { notes[id - 1][1] = body },
  }
}

test('replies once, only when a pull request or commit closed the issue (or it is labelled fixed)', async () => {
  process.env.TEST_MATRIX_TOKEN = 't'
  const posted = []
  const fetchImpl = fakeFetch([[(u) => u.includes('/send/m.room.message/'), (u, i) => (posted.push([u, JSON.parse(i.body)]), { event_id: '$reply' })]])
  // Closed with GitHub's plain "Close" (no commit): no reply
  const plain = fakeClient({ issues: [issue(1)], timeline: [{ event: 'closed', commit_id: null }] })
  assert.deepEqual(await sendReplies({ client: plain, accounts: { matrix: matrixAccount }, fetchImpl, now: NOW }), [])
  // Labelled fixed: replies
  const labelled = fakeClient({ issues: [issue(1, { labels: [{ name: 'fixed' }] })], timeline: [] })
  assert.equal((await sendReplies({ client: labelled, accounts: { matrix: matrixAccount }, fetchImpl, now: NOW })).length, 1)
  // Closed by a PR: replies once with a fixed text in the thread, stable transaction id, notes it; a second run sends nothing
  posted.length = 0
  const client = fakeClient({ issues: [issue(1)] })
  assert.equal((await sendReplies({ client, accounts: { matrix: matrixAccount }, fetchImpl, now: NOW })).length, 1)
  assert.match(posted[0][0], /\/rooms\/!room%3Ax.org\/send\/m.room.message\/feedbai-fixed-o-r-1$/)
  assert.deepEqual(posted[0][1], { msgtype: 'm.text', body: '🤖 This is fixed, thank you for telling us: https://github.com/o/r/issues/1', 'm.relates_to': { 'm.in_reply_to': { event_id: '$evt' } } })
  assert.match(client.notes[0][1], /Replied where the feedback was given: https:\/\/matrix.to\/.*\n\n<!-- feedbai:replied -->/)
  assert.deepEqual(await sendReplies({ client, accounts: { matrix: matrixAccount }, fetchImpl, now: NOW }), [])
  assert.equal(posted.length, 1)
  assert.deepEqual(await sendReplies({ client: fakeClient({ issues: [issue(1)] }), accounts: {}, fetchImpl, now: NOW }), [], 'no account for the channel: nothing sent')
})

test('if the note can\'t be written, nothing is posted (a missed reply, never a repeated one)', async () => {
  const fetchImpl = fakeFetch([[() => true, { event_id: '$x' }]])
  await assert.rejects(sendReplies({ client: fakeClient({ issues: [issue(1)], failNote: true }), accounts: { matrix: matrixAccount }, fetchImpl, now: NOW }), /GitHub is down/)
  assert.equal(fetchImpl.calls.length, 0)
})
