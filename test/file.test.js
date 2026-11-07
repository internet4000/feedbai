import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileChosen, indexIssues } from '../src/issues.js'
import { threadLink } from '../src/replies.js'

const msg = (id, text, extra = {}) => ({
  id: `$${id}`,
  platform: 'matrix',
  project: 'p',
  source: 'room',
  author: { id: `@${id}:x`, name: id },
  text,
  url: `https://matrix.to/#/!r%3Ax/%24${id}`,
  createdAt: `2026-11-07T10:0${id.length}:00.000Z`,
  ...extra,
})
const items = [msg('a', 'exploring all radios does not work?'), msg('bb', 'yes I see only my favorites'), msg('ccc', 'unrelated chat')]
const entry = (mayFile = true) => ({
  project: { id: 'p' },
  source: { id: 'room', type: 'matrix' },
  account: null,
  provider: { type: 'matrix', fetch: async () => items, mayFile: async () => mayFile },
})
const client = (existing = []) => {
  const created = []
  return {
    created,
    repo: 'o/r',
    issues: async () => existing,
    comments: async () => [],
    ensureLabel: async () => {},
    createIssue: async (issue) => (created.push(issue), { html_url: 'https://github.com/o/r/issues/9' }),
    comment: async (n, body) => (created.push({ comment: n, body }), { html_url: `https://github.com/o/r/issues/${n}#c` }),
  }
}

test("the agent files the messages it chose as one issue, in feedbai's format (markers, link back for replies)", async () => {
  const c = client()
  const { action, url, missing } = await fileChosen({
    entries: [entry()],
    client: c,
    links: [items[1].url, decodeURIComponent(items[0].url)],
    title: 'Explore shows only favorites',
    note: 'Regression since the tanstack db upgrade. @someone',
  })
  assert.equal(url, 'https://github.com/o/r/issues/9')
  assert.deepEqual(missing, [])
  assert.equal(action.title, 'Explore shows only favorites')
  const { body } = c.created[0]
  assert.match(body, /^Regression since the tanstack db upgrade\. @​someone\n/)
  assert.ok(body.indexOf('exploring all radios') < body.indexOf('only my favorites'), 'oldest first')
  assert.doesNotMatch(body, /unrelated chat/)
  assert.equal(threadLink(body).url, items[0].url, '"This is fixed" will reply to the first message')
  const index = await indexIssues({ issues: async () => [{ number: 9, body }], comments: async () => [] })
  assert.deepEqual([...index.keys()].sort(), ['$a', '$bb'])
})

test('already filed: added to that issue, or reported; unknown links are listed', async () => {
  const filedBody = 'x\n<!-- feedbai:item=$a -->'
  const c = client([{ number: 4, body: filedBody }])
  const unknown = 'https://matrix.to/#/!r%3Ax/%24nope'
  const more = await fileChosen({ entries: [entry()], client: c, links: [items[0].url, items[1].url, unknown], title: 'x' })
  assert.deepEqual([more.action.type, more.action.issue], ['comment', 4])
  assert.deepEqual(more.missing, [unknown])
  const same = await fileChosen({ entries: [entry()], client: client([{ number: 4, body: filedBody }]), links: [items[0].url], title: 'x' })
  assert.deepEqual([same.action.type, same.url], ['existing', 'https://github.com/o/r/issues/4'])
})

test('a private room that does not name the repo is never filed, even when an agent picks its messages', async () => {
  const c = client()
  const { action, errors } = await fileChosen({ entries: [entry(false)], client: c, links: [items[0].url], title: 'x' })
  assert.equal(action, null)
  assert.equal(c.created.length, 0)
  assert.equal(errors.length, 1)
})
