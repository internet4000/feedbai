import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseSince } from '../src/since.js'

test('relative and absolute dates', () => {
  const now = Date.parse('2026-01-10T00:00:00Z')
  assert.equal(parseSince('2d', now).toISOString(), '2026-01-08T00:00:00.000Z')
  assert.equal(parseSince('2026-01-01', now).toISOString(), '2026-01-01T00:00:00.000Z')
  assert.equal(parseSince(undefined), null)
  assert.throws(() => parseSince('soon'), /since/)
})
