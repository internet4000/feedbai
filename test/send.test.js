import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contactCard, targetKind, resolveTarget, ways, compose, postToBluesky, countSend } from '../src/send.js'
import { fakeFetch } from './helpers.js'

test('a project card keeps only well-formed channels and known contact links (it is untrusted)', () => {
  const card = contactCard({
    project: 'https://github.com/o/r',
    matrix: '#room:example.org',
    bluesky: '#proj',
    contact: ['mailto:hi@example.org', 'https://signal.me/#eu/abc', 'https://wa.me/4912345678', 'javascript:alert(1)', 'https://evil.example/phish', 'tel:+49 30 1234', 'https://bsky.app/chat/abc1234'],
  })
  assert.equal(card.repository, 'https://github.com/o/r')
  assert.equal(card.matrix, '#room:example.org')
  assert.equal(card.bluesky, '#proj')
  assert.deepEqual(card.contact, ['mailto:hi@example.org', 'https://signal.me/#eu/abc', 'https://wa.me/4912345678', 'tel:+49 30 1234', 'https://bsky.app/chat/abc1234'])
  const bad = contactCard({ project: 'javascript:alert(1)', matrix: 'not a room', bluesky: '<b>', contact: 'nope' })
  assert.deepEqual(bad, { repository: null, matrix: null, bluesky: null, records: false, contact: [] })
  assert.equal(contactCard({ bluesky: 'joblist.today' }).bluesky, '@joblist.today')
})

test('targets: a repository, or an https site', () => {
  assert.deepEqual(targetKind('o/r'), { repo: 'https://github.com/o/r' })
  assert.deepEqual(targetKind('https://github.com/o/r'), { repo: 'https://github.com/o/r' })
  assert.deepEqual(targetKind('example.org/docs'), { site: 'https://example.org', page: 'https://example.org/docs' })
  assert.equal(targetKind('http://example.org'), null, 'plain http is not trusted')
  assert.equal(targetKind('nothing'), null)
})

test('a site: its feedbai.json first, its repository config fills the gaps', async () => {
  const fetchImpl = fakeFetch([
    [(u) => u === 'https://example.org/.well-known/feedbai.json', { project: 'o/r', bluesky: '@example.org' }],
    [(u) => u.startsWith('https://raw.githubusercontent.com/o/r/'), { projects: [{ repository: 'https://github.com/o/r', sources: [{ type: 'matrix', room: '#r:x.org' }, { type: 'bluesky', mode: 'search', query: '#other' }] }] }],
  ])
  const card = await resolveTarget('example.org/pricing', { fetchImpl })
  assert.equal(card.repository, 'https://github.com/o/r')
  assert.equal(card.bluesky, '@example.org', 'the site wins')
  assert.equal(card.matrix, '#r:x.org', 'the repo fills in')
  assert.equal(card.page, 'https://example.org/pricing')
})

test('ways to send: prefilled links, marked as drafted by an agent, Bluesky only when it fits a post', () => {
  const card = { repository: 'https://github.com/o/r', matrix: '#r:x.org', bluesky: '#proj', contact: ['mailto:hi@example.org'] }
  const text = compose({ text: 'Search is broken', page: 'https://example.org/docs' })
  assert.ok(text.startsWith('🤖 Search is broken'))
  const list = ways({ card, text, title: 'Search is broken' })
  assert.deepEqual(list.map((w) => w.via), ['issue', 'matrix', 'bluesky', null])
  assert.ok(list[0].link.startsWith('https://github.com/o/r/issues/new?title=Search+is+broken'))
  assert.equal(list[3].link, 'mailto:hi@example.org')
  assert.ok(!ways({ card, text: 'x'.repeat(400), title: 't' }).some((w) => w.via === 'bluesky'))
})

test('a Bluesky post tags the project with a real facet (UTF-8 byte offsets)', async () => {
  const fetchImpl = fakeFetch([[(u) => u.includes('createRecord'), { uri: 'at://did:plc:me/app.bsky.feed.post/3abc' }]])
  const url = await postToBluesky({ session: { base: 'https://pds', token: 't', did: 'did:plc:me', handle: 'me.example' }, text: '🤖 café', target: '#proj', fetchImpl })
  assert.equal(url, 'https://bsky.app/profile/me.example/post/3abc')
  const { record } = JSON.parse(fetchImpl.calls[0].init.body)
  assert.equal(record.text, '🤖 café\n\n#proj')
  const { byteStart, byteEnd } = record.facets[0].index
  assert.equal(Buffer.from(record.text).subarray(byteStart, byteEnd).toString(), '#proj')
  assert.equal(record.facets[0].features[0].tag, 'proj')
})

test('a daily cap per project', () => {
  const now = new Date('2026-11-08T10:00:00Z')
  let state = {}
  for (let i = 0; i < 3; i++) state = countSend(state, 'p', now).state
  assert.equal(countSend(state, 'p', now).today, 3)
  assert.equal(countSend(state, 'p', new Date('2026-11-09T10:00:00Z')).today, 0, 'a new day')
})
