import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, createVerify } from 'node:crypto'
import { appJwt } from '../hub/github.js'
import { roomAllowed } from '../hub/matrix.js'
import { sanitize } from '../hub/run.js'
import { fakeFetch } from './helpers.js'

test('app JWT is RS256-signed with the App id as issuer', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwt = appJwt(123, privateKey.export({ type: 'pkcs1', format: 'pem' }), 1000)
  const [head, body, signature] = jwt.split('.')
  assert.deepEqual(JSON.parse(Buffer.from(body, 'base64url')), { iat: 940, exp: 1540, iss: '123' })
  assert.ok(createVerify('RSA-SHA256').update(`${head}.${body}`).verify(publicKey, signature, 'base64url'))
})

test('a repo may read public rooms, or private rooms whose topic names it', async () => {
  const room = (rule, topic) =>
    fakeFetch([
      [(u) => u.includes('/directory/room/'), { room_id: '!r:x' }],
      [(u) => u.includes('m.room.join_rules'), { join_rule: rule }],
      [(u) => u.includes('m.room.topic'), { topic }],
    ])
  const ask = (fetchImpl, repo = 'radio4000/r4') => roomAllowed({ homeserver: 'https://x', token: 't', room: '#r:x', repo, fetchImpl })
  assert.equal(await ask(room('public', '')), true)
  assert.equal(await ask(room('invite', 'Feedback for github.com/radio4000/r4')), true)
  assert.equal(await ask(room('invite', 'secret team room')), false)
  assert.equal(await ask(room('invite', 'github.com/radio4000/r4'), 'evil/repo'), false)
})

test('sanitize drops accounts, joins and rooms the repo may not read', async () => {
  const config = {
    accounts: [{ id: 'mine', type: 'matrix', secrets: { token: 'X' } }],
    projects: [{ id: 'p', sources: [
      { id: 'ok', type: 'matrix', room: '#ok:x', join: true, account: 'mine' },
      { id: 'no', type: 'matrix', room: '#private:x' },
      { id: 'b', type: 'bluesky', mode: 'search', query: 'q' },
    ] }],
  }
  const safe = await sanitize(config, async (room) => room === '#ok:x')
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
  const { default: matrix, hubUrl } = await import('../src/providers/matrix.js')
  const item = { id: '$1', platform: 'matrix', project: 'hub', source: 'matrix', author: { id: '@u:x' }, text: 'hi', url: 'u', createdAt: '2026-01-01T00:00:00.000Z' }
  const fetchImpl = fakeFetch([[(u) => u.startsWith('https://hub.test/v1/matrix?room=%23r%3Ax'), { items: [item] }]])
  process.env.FEEDBAI_HUB = 'https://hub.test'
  try {
    assert.equal(matrix.authStatus(null), 'hub')
    const items = await matrix.fetch({ project: { id: 'p' }, source: { id: 's', room: '#r:x' }, account: null, since: null, limit: 10, fetchImpl })
    assert.deepEqual(items.map((i) => [i.project, i.source, i.text]), [['p', 's', 'hi']])
    assert.equal(hubUrl({ FEEDBAI_HUB: 'off' }), null)
  } finally {
    delete process.env.FEEDBAI_HUB
  }
})
