import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, createSign } from 'node:crypto'
import { verifyGithubIdentity, resetKeys } from '../hub/identity.js'
import { readMatrix, reactMatrix } from '../hub/api.js'
import { fakeFetch } from './helpers.js'

const AUD = 'https://hub.example'
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' }
const b64 = (x) => Buffer.from(JSON.stringify(x)).toString('base64url')
const now = Math.floor(Date.now() / 1000)
const sign = (claims, header = { alg: 'RS256', kid: 'k1' }, key = privateKey) => {
  const unsigned = `${b64(header)}.${b64(claims)}`
  return `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(key, 'base64url')}`
}
const claims = (extra = {}) => ({ iss: 'https://token.actions.githubusercontent.com', aud: AUD, repository: 'o/r', exp: now + 300, iat: now, ...extra })
const keys = () => fakeFetch([[(u) => u.endsWith('/.well-known/jwks'), { keys: [jwk] }]])

test('a GitHub Actions identity: signed by GitHub, for this hub, not expired, names the repository', async () => {
  resetKeys()
  assert.equal((await verifyGithubIdentity(sign(claims()), { audience: AUD, fetchImpl: keys() })).repository, 'o/r')
  const refused = async (token, why) => assert.rejects(verifyGithubIdentity(token, { audience: AUD, fetchImpl: keys() }), (e) => e.status === 401 && e.message.includes(why))
  await refused(sign(claims({ aud: 'https://other.example' })), 'audience')
  await refused(sign(claims({ iss: 'https://evil.example' })), 'issuer')
  await refused(sign(claims({ exp: now - 600 })), 'expired')
  await refused(sign(claims(), { alg: 'none', kid: 'k1' }), 'algorithm')
  await refused(sign(claims(), { alg: 'RS256', kid: 'k1' }, generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey), 'signature')
  await refused(sign(claims(), { alg: 'RS256', kid: 'nope' }), 'unknown key')
  await refused('not.a.jwt', 'malformed')
})

const env = { FEEDBAI_MATRIX_USER: '@feedbai:x', FEEDBAI_MATRIX_TOKEN: 'bot', FEEDBAI_MATRIX_HOMESERVER: 'https://x.org' }
const room = ({ topic = '', visibility = 'shared' } = {}) => {
  const fetchImpl = fakeFetch([
    [(u) => u.includes('/directory/room/'), { room_id: '!r:x' }],
    [(u) => u.includes('m.room.history_visibility'), { history_visibility: visibility }],
    [(u) => u.includes('m.room.topic'), { topic }],
    [(u) => u.includes('/messages'), { chunk: [{ event_id: '$1', type: 'm.room.message', sender: '@u:x', origin_server_ts: 1, content: { body: 'hi' } }] }],
    [(u) => u.includes('/send/m.reaction/'), { event_id: '$r' }],
  ])
  return fetchImpl
}
const post = (body) => new Request('https://hub.example/v1/matrix/react', { method: 'POST', body: JSON.stringify(body) })
const link = 'https://matrix.to/#/%23r%3Ax/%241'

test('a repository reads, and ✅s in, only rooms whose topic names it (its admins tied them)', async () => {
  process.env.FEEDBAI_MATRIX_TOKEN = 'bot'
  try {
    const identity = { repository: 'o/r' }
    const read = async (fetchImpl, id) => (await readMatrix({ params: new URLSearchParams({ room: '#r:x' }), env, identity: id, fetchImpl })).status
    assert.equal(await read(room({ topic: 'Feedback for github.com/o/r' }), identity), 200)
    assert.equal(await read(room({ topic: 'Feedback for github.com/o/r' }), null), 403, 'no identity: members only')
    assert.equal(await read(room({ topic: 'github.com/someone/else' }), identity), 403, 'another repository')

    assert.equal((await reactMatrix({ request: post({ link }), env, identity: null, fetchImpl: room() })).status, 401)
    assert.equal((await reactMatrix({ request: post({ link }), env, identity, fetchImpl: room({ topic: 'nothing' }) })).status, 403)
    const fetchImpl = room({ topic: 'github.com/o/r' })
    assert.equal((await reactMatrix({ request: post({ link, key: '🚨' }), env, identity, fetchImpl })).status, 200)
    const sent = fetchImpl.calls.find((c) => c.url.includes('/send/m.reaction/'))
    assert.equal(JSON.parse(sent.init.body)['m.relates_to'].key, '✅', 'always ✅, whatever is asked')
    assert.equal((await reactMatrix({ request: post({}), env, identity, fetchImpl })).status, 400)
  } finally {
    delete process.env.FEEDBAI_MATRIX_TOKEN
  }
})
