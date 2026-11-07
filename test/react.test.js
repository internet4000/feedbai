import { test } from 'node:test'
import assert from 'node:assert/strict'
import matrix from '../src/providers/matrix.js'
import { fakeFetch } from './helpers.js'

test('react: a ✅ annotation on the message, with a stable transaction id (reacting twice is a no-op)', async () => {
  process.env.TEST_MX_REACT = 't'
  const account = { id: 'm', type: 'matrix', homeserver: 'https://x.org', secrets: { token: 'TEST_MX_REACT' } }
  const fetchImpl = fakeFetch([[(u) => u.includes('/send/m.reaction/'), { event_id: '$r' }]])
  const where = matrix.parseLink('https://matrix.to/#/!room%3Ax.org/%24evt')
  const link = await matrix.react({ account, ...where, fetchImpl })
  await matrix.react({ account, ...where, fetchImpl })
  const [a, b] = fetchImpl.calls
  assert.equal(a.url, b.url, 'same transaction id both times')
  assert.match(a.url, /\/rooms\/!room%3Ax.org\/send\/m.reaction\/feedbai-react-/)
  assert.deepEqual(JSON.parse(a.init.body), { 'm.relates_to': { rel_type: 'm.annotation', event_id: '$evt', key: '✅' } })
  assert.match(link, /^✅ https:\/\/matrix.to\//)
  const other = fakeFetch([[() => true, {}]])
  await matrix.react({ account, ...where, key: '👀', fetchImpl: other })
  assert.notEqual(other.calls[0].url, a.url, 'another emoji is another reaction')
  await assert.rejects(matrix.react({ account: null, ...where }), /account/)
})
