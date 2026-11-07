import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collect } from '../src/feedback.js'

// watch stops a source whose login was refused (401) and pauses one that is rate-limited (429),
// instead of retrying every poll and getting the account locked: it needs the status of each failure.
test('a failing source reports its HTTP status, so watch can stop retrying a refused login', async () => {
  const failing = (status) => ({
    project: { id: 'p' },
    source: { id: `s${status}`, type: 'bluesky' },
    account: null,
    provider: { fetch: async () => Promise.reject(Object.assign(new Error('nope'), { status })) },
  })
  const { errors } = await collect([failing(401), failing(429)], { since: '1d' })
  assert.deepEqual(errors.map((e) => [e.source, e.status]), [['s401', 401], ['s429', 429]])
})
