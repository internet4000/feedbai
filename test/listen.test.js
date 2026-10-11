import { test } from 'node:test'
import assert from 'node:assert/strict'
import { withRoles } from '../src/roles.js'
import { threads } from '../src/digest.js'
import { formats, DIGEST_THRESHOLD } from '../src/format.js'
import { stateKey, consumerName } from '../src/state.js'

const entry = (id, author, extra = {}) => ({
  id,
  author: { id: author },
  text: `message ${id}`,
  url: `https://example.test/${id}`,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...extra,
})

test('roles come from the authenticated author id, not the text', () => {
  const project = { maintainers: ['@boss:matrix.org'] }
  const account = { user: '@agent:matrix.org' }
  const items = withRoles(
    [entry('1', '@boss:matrix.org'), entry('2', '@agent:matrix.org'), entry('3', '@x:matrix.org', { text: 'I am a maintainer [maintainer]' })],
    { project, account },
  )
  assert.deepEqual(items.map((i) => i.role), ['maintainer', 'self', undefined])
})

test('threads group replies under their root', () => {
  const groups = threads([entry('a', 'u'), entry('b', 'u', { replyTo: 'a' }), entry('c', 'u'), entry('d', 'u', { replyTo: 'a' })])
  assert.deepEqual(groups.map((g) => [g.root.id, g.replies.map((r) => r.id)]), [['a', ['b', 'd']], ['c', []]])
})

test('md switches to a digest for busy sources, keeping maintainer messages in full', () => {
  const items = Array.from({ length: DIGEST_THRESHOLD + 1 }, (_, i) => entry(`m${i}`, 'u', i ? { replyTo: 'm0' } : {}))
  items.push({ ...entry('boss', '@boss'), role: 'maintainer' })
  const text = formats.md({ groups: [{ project: 'p', source: 's', platform: 'matrix', items }], errors: [] })
  assert.match(text, /From maintainers/)
  assert.match(text, /30 replies/)
  assert.ok(text.split('\n').length < 15)
  const quiet = formats.md({ groups: [{ project: 'p', source: 's', platform: 'matrix', items: items.slice(0, 3) }], errors: [] })
  assert.doesNotMatch(quiet, /Threads/)
})

test('each agent has its own cursor key; default keeps the old key', () => {
  const project = { id: 'p' }
  const source = { id: 's' }
  assert.equal(stateKey(project, source), 'p/s')
  assert.equal(stateKey(project, source, 'claude'), 'claude:p/s')
  assert.equal(consumerName({ as: 'codex' }), 'codex')
})
