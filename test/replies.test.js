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

test('replies once in the thread with a fixed text, then notes it on the issue', async () => {
  process.env.TEST_MATRIX_TOKEN = 't'
  const posted = []
  const fetchImpl = fakeFetch([
    [(u, i) => u.includes('/send/m.room.message/'), (u, i) => (posted.push([u, JSON.parse(i.body)]), { event_id: '$reply' })],
  ])
  const notes = []
  const client = { issues: async () => [issue(1)], comments: async () => [], comment: async (n, text) => notes.push([n, text]) }
  const account = { id: 'm', type: 'matrix', homeserver: 'https://x.org', secrets: { token: 'TEST_MATRIX_TOKEN' } }
  const sent = await sendReplies({ client, accounts: { matrix: account }, fetchImpl, now: NOW })
  assert.equal(sent.length, 1)
  assert.match(posted[0][0], /\/rooms\/!room%3Ax.org\/send\//)
  assert.deepEqual(posted[0][1], { msgtype: 'm.text', body: '🤖 Fixed, thank you for the feedback: https://github.com/o/r/issues/1', 'm.relates_to': { 'm.in_reply_to': { event_id: '$evt' } } })
  assert.equal(notes[0][0], 1)
  assert.match(notes[0][1], new RegExp(REPLIED))
  assert.deepEqual(await sendReplies({ client, accounts: {}, fetchImpl, now: NOW }), [], 'no account for the channel: nothing sent')
})
