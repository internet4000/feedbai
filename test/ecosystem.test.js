import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { ecosystem, loopCounts } from '../hub/ecosystem.js'
import { fakeFetch } from './helpers.js'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const env = { FEEDBAI_APP_ID: '1', FEEDBAI_APP_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }) }
const now = Date.parse('2026-11-08T12:00:00Z')
const day = 86400000
const iso = (t) => new Date(t).toISOString()
const config = (projects) => ({ content: Buffer.from(JSON.stringify({ projects })).toString('base64') })

const issues = [
  { created_at: iso(now - 2 * day), state: 'open' },
  { created_at: iso(now - 5 * day), state: 'closed', state_reason: 'completed', closed_at: iso(now - day) },
  { created_at: iso(now - 40 * day), state: 'closed', state_reason: 'completed', closed_at: iso(now - 3 * day) }, // filed before, fixed in the window
  { created_at: iso(now - 4 * day), state: 'closed', state_reason: 'not_planned', closed_at: iso(now - day) }, // filed, not fixed
  { created_at: iso(now - day), state: 'open', pull_request: {} }, // a pull request: not counted
]

test('loop counts: filed and fixed in the last 30 days, open now, pull requests and "not planned" aside', async () => {
  const fetchImpl = fakeFetch([[(u) => u.includes('/issues?labels=feedback'), issues]])
  assert.deepEqual(await loopCounts({ fullName: 'o/r', token: 't', now, fetchImpl }), { filed: 3, fixed: 2, open: 1 })
})

test('the ecosystem lists only public repos whose own config says listed, with numbers and channel kinds only', async () => {
  const configs = {
    'o/listed': config([{ id: 'listed', repository: 'https://github.com/O/listed', listed: true, sources: [{ type: 'matrix', room: '#secret:x' }, { type: 'bluesky' }, { type: 'matrix' }] }]),
    'o/quiet': config([{ id: 'quiet', repository: 'https://github.com/o/quiet' }]),
    'o/impostor': config([{ id: 'someone-else', repository: 'https://github.com/other/project', listed: true }]),
    'o/private': config([{ id: 'private', repository: 'https://github.com/o/private', listed: true }]),
  }
  const fetchImpl = fakeFetch([
    [(u) => u.endsWith('/app/installations?per_page=100'), [{ id: 7 }]],
    [(u) => u.includes('/access_tokens'), { token: 'inst' }],
    [(u) => u.includes('/installation/repositories'), { repositories: [{ full_name: 'o/listed' }, { full_name: 'o/quiet' }, { full_name: 'o/impostor' }, { full_name: 'o/private', private: true }] }],
    [(u) => u.includes('/contents/feedbai.config.json'), (u) => configs[u.split('/repos/')[1].split('/contents')[0]]],
    [(u) => u.includes('/issues?labels=feedback'), issues],
  ])
  const result = await ecosystem({ env, now, fetchImpl })
  assert.deepEqual(result.projects, [{ id: 'listed', repository: 'https://github.com/o/listed', channels: ['bluesky', 'matrix'], filed: 3, fixed: 2, open: 1 }])
  assert.equal(result.days, 30)
  assert.ok(!JSON.stringify(result).includes('#secret'), 'no room names')
  assert.ok(!fetchImpl.calls.some((c) => c.url.includes('/repos/o/private/')), 'private repos are not even read')
})
