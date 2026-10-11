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
