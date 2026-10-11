import { test } from 'node:test'
import assert from 'node:assert/strict'
import matrix, { parseRoom } from '../src/providers/matrix.js'
import { fakeFetch } from './helpers.js'

process.env.TEST_MATRIX_TOKEN = 'secret'
const account = { id: 'm', type: 'matrix', homeserver: 'https://hs.test', secrets: { token: 'TEST_MATRIX_TOKEN' } }
const ctx = { project: { id: 'r4' }, source: { id: 'chat', room: 'https://matrix.to/#/#r4:hs.test' }, account }

const event = (id, ts, content) => ({ type: 'm.room.message', event_id: id, sender: '@ana:hs.test', origin_server_ts: ts, content })

test('parses matrix.to links', () => {
  assert.equal(parseRoom('https://matrix.to/#/%23radio4000%3Amatrix.org'), '#radio4000:matrix.org')
  assert.equal(parseRoom('#radio4000:matrix.org'), '#radio4000:matrix.org')
})

test('resolves alias, paginates back to `since`, reads edits as new text, returns oldest first', async () => {
  const fetchImpl = fakeFetch([
    [(u) => u.includes('/directory/room/'), { room_id: '!room:hs.test' }],
    [(u) => u.includes('/messages') && u.includes('from=p2'), {
      chunk: [event('$2', 2000, { body: 'second' }), event('$old', 500, { body: 'too old' })],
    }],
    [(u) => u.includes('/messages'), {
      end: 'p2',
      state: [{ type: 'm.room.member', state_key: '@ana:hs.test', content: { displayname: 'Ana' } }],
      chunk: [
        event('$3', 3000, { body: 'third', 'm.relates_to': { 'm.in_reply_to': { event_id: '$2' } } }),
        event('$edit', 2500, { body: '* fix', 'm.new_content': { body: 'fix' }, 'm.relates_to': { rel_type: 'm.replace', event_id: '$2' } }),
      ],
    }],
  ])
  const items = await matrix.fetch({ ...ctx, since: new Date(1000), limit: 10, fetchImpl })
  assert.deepEqual(items.map((i) => i.text), ['second', 'fix', 'third'])
  assert.equal(items[1].edits, '$2')
  assert.equal(items[2].replyTo, '$2')
  assert.equal(items[2].author.name, 'Ana')
  assert.match(items[0].url, /^https:\/\/matrix\.to\/#\/!room%3Ahs\.test\/%242$/)
  assert.equal(fetchImpl.calls[1].init.headers.authorization, 'Bearer secret')
})

test('requires a token and explains 403', async () => {
  await assert.rejects(matrix.fetch({ ...ctx, account: null, limit: 1 }), /requires an authenticated/)
  const fetchImpl = fakeFetch([
    [(u) => u.includes('/directory/room/'), { room_id: '!room:hs.test' }],
    [(u) => u.includes('/messages'), { errcode: 'M_FORBIDDEN' }, 403],
  ])
  await assert.rejects(matrix.fetch({ ...ctx, limit: 1, fetchImpl }), /not joined/)
})

test('ancestors walks the reply chain, oldest first', async () => {
  const fetchImpl = fakeFetch([
    [(u) => u.includes('/event/%24p'), event('$p', 2000, { body: 'parent', 'm.relates_to': { 'm.in_reply_to': { event_id: '$g' } } })],
    [(u) => u.includes('/event/%24g'), event('$g', 1000, { body: 'grandparent' })],
  ])
  const entry = { url: 'https://matrix.to/#/!room%3Ahs.test/%24r', replyTo: '$p' }
  const chain = await matrix.ancestors({ ...ctx, entry, fetchImpl })
  assert.deepEqual(chain.map((i) => i.text), ['grandparent', 'parent'])
})
