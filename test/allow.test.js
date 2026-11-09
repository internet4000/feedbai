import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allows, listed, topicAllowed } from '../hub/allow.js'
import { acceptInvites } from '../hub/matrix.js'
import { readMatrix, readBlueskySearch } from '../hub/api.js'
import { fakeFetch } from './helpers.js'

const locked = { FEEDBAI_PROJECTS: 'internet4000/feedbai, Other/Repo' }

test('FEEDBAI_PROJECTS: unset opens the hub to all; set (even empty) lists the only projects', () => {
  assert.equal(listed({}), null)
  assert.equal(allows({}, 'anyone/anything'), true)
  assert.deepEqual(listed(locked), ['internet4000/feedbai', 'other/repo'])
  assert.equal(allows(locked, 'Internet4000/Feedbai'), true)
  assert.equal(allows(locked, 'internet4000/feedbai-fork'), false)
  assert.equal(allows({ FEEDBAI_PROJECTS: '' }, 'internet4000/feedbai'), false)
  assert.equal(allows(locked, undefined), false)
})

test('a room belongs to a listed project only if its topic names the whole repository', () => {
  assert.equal(topicAllowed(locked, 'Feedback → https://github.com/internet4000/feedbai'), true)
  assert.equal(topicAllowed(locked, 'github.com/internet4000/feedbai-fork'), false)
  assert.equal(topicAllowed(locked, ''), false)
  assert.equal(topicAllowed({}, ''), true)
})

test('invite-only: the bot joins only public rooms of listed projects, leaves the others, and says why', async () => {
  const invite = (rule, topic) => ({
    invite_state: { events: [{ type: 'm.room.join_rules', content: { join_rule: rule } }, ...(topic ? [{ type: 'm.room.topic', content: { topic } }] : [])] },
  })
  const fetchImpl = fakeFetch([
    [(u) => u.includes('/sync'), { rooms: { invite: { '!ours:x': invite('public', 'github.com/internet4000/feedbai'), '!theirs:x': { invite_state: { events: [...invite('public', 'github.com/someone/else').invite_state.events, { type: 'm.room.canonical_alias', content: { alias: '#theirs:x' } }] } }, '!none:x': invite('public') }, join: { '!kept:x': {}, '!stranger:x': {} } } }],
    [(u) => u.includes('/state/m.room.join_rules'), { join_rule: 'public' }],
    [(u) => u.includes('!kept%3Ax/state/m.room.topic'), { topic: 'https://github.com/internet4000/feedbai' }],
    [(u) => u.includes('!stranger%3Ax/state/m.room.topic'), { topic: 'a room about something else' }],
    [(u, i) => i?.method === 'POST', {}],
  ])
  const { why, ...result } = await acceptInvites({ homeserver: 'https://x', token: 't', fetchImpl, topicOk: (topic) => topicAllowed(locked, topic), env: locked })
  assert.deepEqual(result, { joined: ['!ours:x'], declined: ['!theirs:x', '!none:x'], left: ['!stranger:x'] })
  // The reason, shown in the room, says which room, what topic it read, what it accepts, and the fix
  const reason = JSON.parse(fetchImpl.calls.find((c) => c.url.includes('!theirs%3Ax/leave')).init.body).reason
  assert.match(reason, /invite-only.*#theirs:x.*github\.com\/internet4000\/feedbai, github\.com\/other\/repo.*Topic now: "github\.com\/someone\/else".*add your project's github\.com\/owner\/name to the room topic.*your own hub/s)
  assert.match(JSON.parse(fetchImpl.calls.find((c) => c.url.includes('!none%3Ax/leave')).init.body).reason, /Topic now: empty/)
  // …and the hub's log, one line per room
  assert.deepEqual(why.map((line) => line.split(':')[0]), ['declined #theirs', 'declined !none', 'left !stranger'])
  assert.match(why[0], /^declined #theirs:x \(!theirs:x\): /)
})

test('invite-only: the read API serves only rooms of listed projects, and Bluesky search only to their GitHub Actions', async () => {
  const env = { ...locked, FEEDBAI_MATRIX_USER: '@feedbai:matrix.org', FEEDBAI_MATRIX_TOKEN: 'bot-token' }
  const fetchImpl = fakeFetch([
    [(u) => u.includes('/directory/room/'), { room_id: '!r:x' }],
    [(u) => u.includes('m.room.topic'), { topic: 'not ours' }],
  ])
  const res = await readMatrix({ params: new URLSearchParams({ room: '#r:x' }), env, fetchImpl })
  assert.equal(res.status, 403)
  assert.match((await res.json()).error, /invite-only/)
  assert.ok(!fetchImpl.calls.some((c) => c.url.includes('/messages')), 'no messages read')

  const search = await readBlueskySearch({ params: new URLSearchParams({ query: '#x' }), env: { ...env, FEEDBAI_BLUESKY_PASSWORD: 'p' } })
  assert.equal(search.status, 403)
  assert.match((await search.json()).error, /invite-only/)
})
