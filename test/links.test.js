import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRepo, projectUri, pageAddress } from '../src/links.js'
import { repoOf, pageAddress as buttonPageAddress } from '../site/public/embed.js'

const repos = [
  'internet4000/feedbai',
  'github.com/internet4000/feedbai',
  'https://github.com/internet4000/feedbai',
  'https://github.com/internet4000/feedbai/',
  'https://www.github.com/internet4000/feedbai.git',
  'http://github.com/a-b/c.d',
  'https://github.com/internet4000/feedbai/issues/1',
  'https://github.com/internet4000/feedbai/discussions/3',
  'https://gitlab.com/a/b',
  'github.com/onlyowner',
  'nope',
  '',
]
const pages = ['https://x.example/reset?token=abc#me', 'https://user:pw@x.example/a', 'http://x.example', 'javascript:alert(1)', 'not a url', '']

test('a repository: owner/name or a link; strict means the repository itself, not something in it', () => {
  assert.deepEqual(parseRepo('internet4000/feedbai'), { owner: 'internet4000', name: 'feedbai' })
  assert.deepEqual(parseRepo('https://github.com/internet4000/feedbai/discussions/3'), { owner: 'internet4000', name: 'feedbai' })
  assert.equal(parseRepo('https://github.com/internet4000/feedbai/discussions/3', { strict: true }), null)
  assert.equal(projectUri('https://www.github.com/internet4000/feedbai.git'), 'https://github.com/internet4000/feedbai')
  assert.equal(parseRepo('github.com/onlyowner'), null, 'not owner "github.com"')
  assert.equal(parseRepo('https://gitlab.com/a/b'), null)
})

test('the Feedback button (a single self-hostable file) parses addresses exactly like the CLI', () => {
  for (const value of repos) {
    const repo = parseRepo(value, { strict: true })
    assert.equal(repoOf(value), repo ? `${repo.owner}/${repo.name}` : null, value)
  }
  for (const href of pages) assert.equal(buttonPageAddress(href), pageAddress(href), href)
})
