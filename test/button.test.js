import { test } from 'node:test'
import assert from 'node:assert/strict'
import { routes, pageAddress, repoOf } from '../site/public/embed.js'

test('the page address keeps origin and path only (query strings and fragments can hold tokens)', () => {
  assert.equal(pageAddress('https://x.example/reset?token=abc#me'), 'https://x.example/reset')
  assert.equal(pageAddress('https://user:pw@x.example/a'), 'https://x.example/a')
  assert.equal(pageAddress('javascript:alert(1)'), '')
  assert.equal(pageAddress('not a url'), '')
})

test('a project is a GitHub repo, in any common spelling', () => {
  for (const p of ['https://github.com/o/r', 'github.com/o/r/', 'o/r', 'https://github.com/o/r.git']) assert.equal(repoOf(p), 'o/r')
  assert.equal(repoOf('https://gitlab.com/o/r'), null)
  assert.equal(repoOf('https://github.com/o/r/issues/1'), null)
})

test('feedback goes to prefilled public places: Bluesky, a GitHub issue, the Matrix room', () => {
  const out = routes({ text: ' Play button broken ', page: 'https://x.example/p', project: 'https://github.com/o/r', matrix: '#r:matrix.org', bluesky: '#r' })
  assert.deepEqual(out.map((r) => r.id), ['bluesky', 'github', 'matrix'])
  const post = new URL(out[0].href).searchParams.get('text')
  assert.equal(post, 'Play button broken #r\nhttps://x.example/p')
  const issue = new URL(out[1].href)
  assert.equal(issue.pathname, '/o/r/issues/new')
  assert.equal(issue.searchParams.get('title'), 'Play button broken')
  assert.match(issue.searchParams.get('body'), /^Play button broken\n\nPage: https:\/\/x.example\/p\n/)
  assert.equal(out[2].href, 'https://matrix.to/#/%23r%3Amatrix.org')
  assert.equal(out[2].copy, '@feedbai:matrix.org Play button broken\nhttps://x.example/p', 'mentions the bot, so it becomes an issue')
})

test('long feedback fits a Bluesky post, keeping the tag and page', () => {
  const [post] = routes({ text: '🙂'.repeat(500), page: 'https://x.example/p', bluesky: '#r' })
  const text = new URL(post.href).searchParams.get('text')
  assert.ok([...new Intl.Segmenter().segment(text)].length <= 300)
  assert.match(text, /… #r\nhttps:\/\/x.example\/p$/)
})

test('without a project or room, only Bluesky is offered', () => {
  assert.deepEqual(routes({ text: 'hi' }).map((r) => r.id), ['bluesky'])
})
