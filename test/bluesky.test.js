import { test } from 'node:test'
import assert from 'node:assert/strict'
import bluesky, { toAtUri } from '../src/providers/bluesky.js'
import { fakeFetch } from './helpers.js'

process.env.TEST_BSKY_PASSWORD = 'app-pass'
const account = { id: 'b', type: 'bluesky', service: 'https://pds.test', identifier: 'me.test', secrets: { password: 'TEST_BSKY_PASSWORD' } }
const post = (rkey, createdAt, text) => ({
  uri: `at://did:plc:x/app.bsky.feed.post/${rkey}`,
  author: { handle: 'ana.test', displayName: 'Ana' },
  record: { text, createdAt },
})

test('converts bsky.app links to AT URIs', () => {
  assert.equal(toAtUri('https://bsky.app/profile/ana.test/post/abc'), 'at://ana.test/app.bsky.feed.post/abc')
})

test('search logs in once, sends the token, and maps posts', async () => {
  const fetchImpl = fakeFetch([
    [(u) => u.endsWith('createSession'), { accessJwt: 'jwt', handle: 'me.test' }],
    [(u) => u.includes('searchPosts'), { posts: [post('2', '2026-01-02T00:00:00Z', 'b'), post('1', '2026-01-01T00:00:00Z', 'a')] }],
  ])
  const source = { id: 's', type: 'bluesky', mode: 'search', query: 'radio4000' }
  const items = await bluesky.fetch({ project: { id: 'r4' }, source, account, limit: 10, fetchImpl })
  assert.deepEqual(items.map((i) => i.text), ['a', 'b'])
  assert.equal(items[0].url, 'https://bsky.app/profile/ana.test/post/1')
  assert.equal(fetchImpl.calls[1].init.headers.authorization, 'Bearer jwt')
  assert.ok(fetchImpl.calls[1].url.startsWith('https://pds.test/xrpc/app.bsky.feed.searchPosts?q=radio4000'))
})

test('author mode is public and stops at `since`', async () => {
  const fetchImpl = fakeFetch([
    [(u) => u.includes('getAuthorFeed'), {
      cursor: 'next',
      feed: [{ post: post('3', '2026-01-03T00:00:00Z', 'new') }, { post: post('1', '2026-01-01T00:00:00Z', 'old') }],
    }],
  ])
  const source = { id: 'a', type: 'bluesky', mode: 'author', actor: 'ana.test' }
  const items = await bluesky.fetch({ project: { id: 'r4' }, source, account: null, since: new Date('2026-01-02'), limit: 10, fetchImpl })
  assert.deepEqual(items.map((i) => i.text), ['new'])
  assert.ok(fetchImpl.calls[0].url.startsWith('https://public.api.bsky.app/'))
  assert.equal(fetchImpl.calls.length, 1)
})

test('search without an account is refused', async () => {
  const source = { id: 's', type: 'bluesky', mode: 'search', query: 'x' }
  await assert.rejects(bluesky.fetch({ project: { id: 'r4' }, source, account: null, limit: 1 }), /requires an authenticated/)
})
