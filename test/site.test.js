import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { DOCS, resolveLink, toPage, pagePath } from '../site/docs.mjs'

// The website itself is built and link-checked by Astro (site/, `npm run build`, CI). These check what
// decides which docs it shows and how, with no dependencies.
const root = new URL('..', import.meta.url)

test('every doc in the repo is on the website', () => {
  const files = ['docs', 'docs/channels'].flatMap((dir) => readdirSync(new URL(dir, root)).filter((f) => f.endsWith('.md')).map((f) => `${dir}/${f}`))
  const served = DOCS.map((d) => d.file)
  for (const file of files) assert.ok(served.includes(file), `${file} is not in DOCS (site/docs.mjs)`)
  for (const file of served) assert.ok(readFileSync(new URL(file, root), 'utf8').startsWith('# '), `${file} starts with its # title`)
  assert.equal(new Set(DOCS.map((d) => d.route)).size, DOCS.length, 'routes are unique')
})

test('repo links point at site pages, other files at GitHub', () => {
  assert.equal(resolveLink('docs/getting-started.md', '../hub/README.md'), '/docs/hub/')
  assert.equal(resolveLink('docs/getting-started.md', 'configuration.md#global-config-and-accounts'), '/docs/configuration/#global-config-and-accounts')
  assert.equal(resolveLink('docs/channels/README.md', '../issues.md'), '/docs/issues/')
  assert.equal(resolveLink('docs/README.md', 'channels/README.md'), '/docs/channels/')
  assert.equal(resolveLink('docs/on-your-own.md', '../.github/workflows/feedbai.yml'), 'https://github.com/internet4000/feedbai/blob/main/.github/workflows/feedbai.yml')
  assert.equal(resolveLink('docs/channels/README.md', '../../src/providers/'), 'https://github.com/internet4000/feedbai/tree/main/src/providers/')
  assert.equal(resolveLink('docs/x.md', 'https://bsky.app'), 'https://bsky.app')
  assert.equal(resolveLink('docs/x.md', '#here'), '#here')
})

test('a doc becomes a page: title in frontmatter, links rewritten outside code only', () => {
  const doc = { file: 'docs/x.md', route: '/docs/x', label: 'X' }
  const md = ['# The `x` doc', '', 'See [issues](issues.md) and `[not](a.md)`.', '', '```md', '[kept](issues.md)', '```'].join('\n')
  const { title, text } = toPage(doc, md)
  assert.equal(title, 'The x doc')
  assert.match(text, /^---\n# Generated from docs\/x.md[^\n]*\ntitle: "The x doc"\neditUrl: "https:\/\/github.com\/internet4000\/feedbai\/edit\/main\/docs\/x.md"\nsidebar:\n  label: "X"\n---\n\nSee/)
  assert.match(text, /\[issues\]\(\/docs\/issues\/\) and `\[not\]\(a.md\)`/)
  assert.match(text, /```md\n\[kept\]\(issues.md\)\n```/)
  assert.doesNotMatch(text.split('\n---\n')[1], /^# /m, 'the title is not repeated in the body')
  assert.equal(pagePath({ route: '/docs' }), 'docs/index.md')
  assert.equal(pagePath({ route: '/docs/channels/matrix' }), 'docs/channels/matrix.md')
})
