import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, createVerify } from 'node:crypto'
import { appJwt } from '../hub/github.js'
import matrix, { topicNamesRepo } from '../src/providers/matrix.js'
import { sanitize } from '../hub/run.js'
import { fakeFetch } from './helpers.js'

test('app JWT is RS256-signed with the App id as issuer', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwt = appJwt(123, privateKey.export({ type: 'pkcs1', format: 'pem' }), 1000)
  const [head, body, signature] = jwt.split('.')
  assert.deepEqual(JSON.parse(Buffer.from(body, 'base64url')), { iat: 940, exp: 1540, iss: '123' })
  assert.ok(createVerify('RSA-SHA256').update(`${head}.${body}`).verify(publicKey, signature, 'base64url'))
})

test('a repo may file public rooms, or private rooms whose topic names it', async () => {
  const room = (rule, topic) =>
    fakeFetch([
      [(u) => u.includes('/directory/room/'), { room_id: '!r:x' }],
      [(u) => u.includes('m.room.join_rules'), { join_rule: rule }],
      [(u) => u.includes('m.room.topic'), { topic }],
    ])
  process.env.FEEDBAI_TEST_TOKEN = 't'
  const account = { id: 'a', type: 'matrix', homeserver: 'https://x', secrets: { token: 'FEEDBAI_TEST_TOKEN' } }
  const ask = (fetchImpl, repo = 'radio4000/r4') => matrix.mayFile({ source: { room: '#r:x' }, account, repo, fetchImpl })
  assert.equal(await ask(room('public', '')), true)
  assert.equal(await ask(room('invite', 'Feedback for github.com/radio4000/r4')), true)
  assert.equal(await ask(room('invite', 'secret team room')), false)
  assert.equal(await ask(room('invite', 'github.com/radio4000/r4'), 'evil/repo'), false)
  assert.equal(await ask(room('invite', 'github.com/internet4000/feedbai'), 'ernet4000/feedbai'), false)
})

test('a topic names a repo only as a whole github.com/owner/name', () => {
  assert.equal(topicNamesRepo('Feedback: https://github.com/a/b', 'a/b'), true)
  assert.equal(topicNamesRepo('see github.com/A/B.', 'a/b'), true)
  assert.equal(topicNamesRepo('github.com/xa/b', 'a/b'), false)
  assert.equal(topicNamesRepo('github.com/a/b-c', 'a/b'), false)
  assert.equal(topicNamesRepo('github.com/a/b.js', 'a/b'), false)
  assert.equal(topicNamesRepo('evilgithub.com/a/b', 'a/b'), false)
  assert.equal(topicNamesRepo('a/b', 'a/b'), false)
})

test('sanitize drops accounts, joins and mentions', () => {
  const config = {
    accounts: [{ id: 'mine', type: 'matrix', secrets: { token: 'X' } }],
    projects: [{ id: 'p', sources: [
      { id: 'ok', type: 'matrix', room: '#ok:x', join: true, account: 'mine' },
      { id: 'b', type: 'bluesky', mode: 'search', query: 'q' },
      { id: 'm', type: 'bluesky', mode: 'mentions' },
    ] }],
  }
  const safe = sanitize(config)
  assert.deepEqual(safe, { projects: [{ id: 'p', sources: [{ id: 'ok', type: 'matrix', room: '#ok:x' }, { id: 'b', type: 'bluesky', mode: 'search', query: 'q' }] }] })
})

test('github client pages through results; index maps item markers to issues', async () => {
  const { githubClient } = await import('../src/github.js')
  const { indexIssues } = await import('../src/issues.js')
  const page1 = Array.from({ length: 100 }, (_, i) => ({ number: i + 1, body: '' }))
  const fetchImpl = fakeFetch([
    [(u) => u.includes('/issues?labels=') && u.includes('&page=1'), [...page1.slice(0, 99), { number: 100, body: '<!-- feedbai:item=$a -->' }]],
    [(u) => u.includes('/issues?labels=') && u.includes('&page=2'), [{ number: 101, body: '<!-- feedbai:item=$b -->' }]],
    [(u) => u.includes('/issues/comments'), [{ issue_url: 'https://api.github.com/repos/o/r/issues/100', body: '<!-- feedbai:item=$c -->' }]],
  ])
  const index = await indexIssues(githubClient({ token: 't', repo: 'o/r', fetchImpl }))
  assert.deepEqual([...index], [['$a', 100], ['$b', 101], ['$c', 100]])
})

test('requests send a User-Agent (GitHub requires one; Workers fetch adds none)', async () => {
  const { request } = await import('../src/http.js')
  const fetchImpl = fakeFetch([[() => true, {}]])
  await request('https://api.github.com/app', { fetchImpl })
  assert.match(fetchImpl.calls[0].init.headers['user-agent'], /^feedbai/)
})

test('the bot is mentioned by pill or "@name", never by the bare word (bots share their project name)', async () => {
  const { mentionsSelf } = await import('../src/roles.js')
  const account = { user: '@feedbai:matrix.org' }
  const says = (text, mentions) => mentionsSelf({ text, mentions }, { account })
  assert.equal(says('i don\'t think "feedbai" is an agent'), false)
  assert.equal(says('https://feedbai.internet4000.com/'), false)
  assert.equal(says('mail me at x@feedbai.org'), false)
  assert.equal(says('@feedbai the play button is broken'), true)
  assert.equal(says('hey @feedbai: broken', []), true)
  assert.equal(says('feedbai: broken', ['@feedbai:matrix.org']), true)
})

test('read API serves public rooms the bot is in, and says what to do otherwise', async () => {
  const { readMatrix } = await import('../hub/api.js')
  const env = { FEEDBAI_MATRIX_USER: '@feedbai:matrix.org', FEEDBAI_MATRIX_TOKEN: 'bot-token' }
  const event = { event_id: '$1', type: 'm.room.message', sender: '@u:x', origin_server_ts: 1, content: { body: 'hi' } }
  const room = (rule, messages = [{ chunk: [event] }, 200]) =>
    fakeFetch([
      [(u) => u.includes('/directory/room/'), { room_id: '!r:x' }],
      [(u) => u.includes('m.room.join_rules'), { join_rule: rule }],
      [(u) => u.includes('/messages'), ...messages],
    ])
  const ask = async (fetchImpl) => {
    const res = await readMatrix({ params: new URLSearchParams({ room: '#r:x' }), env, fetchImpl })
    return { status: res.status, body: await res.json() }
  }
  process.env.FEEDBAI_MATRIX_TOKEN = 'bot-token' // the provider reads secrets from process.env, as in the Worker
  try {
    const ok = await ask(room('public'))
    assert.equal(ok.status, 200)
    assert.deepEqual(ok.body.items.map((i) => i.text), ['hi'])
    assert.equal((await ask(room('invite'))).status, 403)
    const notJoined = await ask(room('public', [{ errcode: 'M_FORBIDDEN' }, 403]))
    assert.equal(notJoined.status, 403)
    assert.match(notJoined.body.error, /invite @feedbai:matrix\.org to #r:x/)
    // A bot outside the room cannot even read its join rules: that is "invite", not "private"
    const outside = fakeFetch([
      [(u) => u.includes('/directory/room/'), { room_id: '!r:x' }],
      [(u) => u.includes('m.room.join_rules'), { errcode: 'M_FORBIDDEN' }, 403],
    ])
    assert.match((await ask(outside)).body.error, /invite @feedbai:matrix\.org/)
  } finally {
    delete process.env.FEEDBAI_MATRIX_TOKEN
  }
})

test('without an account, Matrix sources read through the hub (FEEDBAI_HUB=off disables)', async () => {
  const { default: matrix } = await import('../src/providers/matrix.js')
  const { hubUrl } = await import('../src/hub.js')
  const item = { id: '$1', platform: 'matrix', project: 'hub', source: 'matrix', author: { id: '@u:x' }, text: 'hi', url: 'u', createdAt: '2026-01-01T00:00:00.000Z' }
  const fetchImpl = fakeFetch([[(u) => u.startsWith('https://hub.test/v1/matrix?room=%23r%3Ax'), { items: [item] }]])
  process.env.FEEDBAI_HUB = 'https://hub.test'
  try {
    assert.equal(matrix.authStatus(null), 'hub')
    const { items } = await matrix.fetch({ project: { id: 'p' }, source: { id: 's', room: '#r:x' }, account: null, since: null, limit: 10, fetchImpl })
    assert.deepEqual(items.map((i) => [i.project, i.source, i.text]), [['p', 's', 'hi']])
    assert.equal(hubUrl({ FEEDBAI_HUB: 'off' }), null)
  } finally {
    delete process.env.FEEDBAI_HUB
  }
})

test('Bluesky searches and author feeds are read for sentiment, never filed as issues', async () => {
  const { filesIssues } = await import('../src/issues.js')
  const files = (source) => filesIssues({ source })
  assert.equal(files({ type: 'bluesky', mode: 'search', query: 'q' }), false)
  assert.equal(files({ type: 'bluesky', mode: 'author', actor: 'a' }), false)
  assert.equal(files({ type: 'bluesky', mode: 'mentions' }), true)
  assert.equal(files({ type: 'bluesky', mode: 'thread', post: 'p' }), true)
  assert.equal(files({ type: 'matrix', room: '#r:x' }), true)
})

test('read API searches Bluesky with the hub account, or says it has none', async () => {
  const { readBlueskySearch } = await import('../hub/api.js')
  const ask = async (env, fetchImpl) => {
    const res = await readBlueskySearch({ params: new URLSearchParams({ query: '#r4' }), env, fetchImpl })
    return { status: res.status, body: await res.json() }
  }
  assert.equal((await ask({})).status, 503)
  process.env.FEEDBAI_BLUESKY_PASSWORD = 'hub-pass'
  try {
    const fetchImpl = fakeFetch([
      [(u) => u.endsWith('createSession'), { accessJwt: 'jwt', handle: 'feedbai.bsky.social' }],
      [(u) => u.includes('searchPosts'), { posts: [{ uri: 'at://x/app.bsky.feed.post/1', author: { handle: 'ana.test' }, record: { text: 'love it', createdAt: '2026-01-01T00:00:00Z' } }] }],
    ])
    const ok = await ask({ FEEDBAI_BLUESKY_IDENTIFIER: 'feedbai.bsky.social', FEEDBAI_BLUESKY_PASSWORD: 'hub-pass' }, fetchImpl)
    assert.equal(ok.status, 200)
    assert.deepEqual(ok.body.items.map((i) => i.text), ['love it'])
  } finally {
    delete process.env.FEEDBAI_BLUESKY_PASSWORD
  }
})

test('fileIssues refuses sources whose provider says the repo may not file them', async () => {
  const { fileIssues } = await import('../src/issues.js')
  let fetched = false
  const provider = { mayFile: async () => false, fetch: async () => ((fetched = true), []) }
  const entry = { project: { id: 'p' }, source: { id: 'private', type: 'matrix' }, account: null, provider }
  const client = { repo: 'o/r', issues: async () => [], comments: async () => [] }
  const { actions, errors } = await fileIssues({ entries: [entry], client })
  assert.equal(fetched, false)
  assert.deepEqual(actions, [])
  assert.match(errors[0].error, /github\.com\/o\/r/)
})

test('issue bodies cannot ping GitHub users or forge item markers', async () => {
  const { planIssues, indexIssues } = await import('../src/issues.js')
  const entry = {
    id: '$x', platform: 'bluesky', project: 'p', source: 's', createdAt: '2026-01-01T00:00:00Z', url: 'https://bsky.app/x',
    author: { id: 'a.bsky.social', name: '@torvalds' },
    text: 'hey @octocat <!-- feedbai:item=$future -->',
  }
  const [{ body }] = planIssues([entry], new Map())
  assert.doesNotMatch(body, /@octocat|@torvalds/)
  assert.match(body, /@​octocat/)
  const index = await indexIssues({ issues: async () => [{ number: 1, body }], comments: async () => [] })
  assert.deepEqual([...index.keys()], ['$x'])
})
