import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { render, inline } from '../hub/markdown.js'
import { site, DOCS, resolveLink } from '../hub/site.js'

const root = new URL('..', import.meta.url)
const read = (file) => readFileSync(new URL(file, root), 'utf8')
const docs = Object.fromEntries(DOCS.map((d) => [d.file, read(d.file)]))
const ways = ['/', '/agent', '/diy', '/self-host', '/give']
const pages = () => [...ways, ...DOCS.map((d) => d.route)].map((path) => ({ path, ...site({ path, docs }) }))

test('markdown: blocks, ids, tables, nested code, and raw HTML stays text', () => {
  const md = [
    '# Title',
    '## Roles: who is speaking',
    'Text with `code <b>` and [a link](x.md#y) and **bold**, _em_ and snake_case_name.',
    '- one',
    '- two with code:',
    '',
    '  ```json',
    '  { "a": 1 }',
    '  ```',
    '',
    '| a | b |',
    '| --- | --- |',
    '| `x\\|y` | <script>alert(1)</script> |',
    '',
    '```mermaid',
    'flowchart LR',
    '  a["x<br/>y"] --> b',
    '```',
  ].join('\n')
  const { html, title, headings, mermaid } = render(md, { link: (h) => `/to/${h}` })
  assert.equal(title, 'Title')
  assert.deepEqual(headings.map((h) => h.id), ['roles-who-is-speaking'])
  assert.match(html, /<code>code &lt;b&gt;<\/code>/)
  assert.match(html, /<a href="\/to\/x.md#y">a link<\/a>/)
  assert.match(html, /<strong>bold<\/strong>, <em>em<\/em> and snake_case_name/)
  assert.match(html, /<li><p>two with code:<\/p>\n<pre data-lang="json"><code>\{ &quot;a&quot;: 1 \}<\/code><\/pre><\/li>/)
  assert.match(html, /<td><code>x\|y<\/code><\/td><td>&lt;script&gt;/)
  assert.ok(mermaid)
  assert.match(html, /<pre class="mermaid">flowchart LR\n  a\[&quot;x&lt;br\/&gt;y&quot;\]/)
  assert.doesNotMatch(html, /<script/)
})

test('markdown: bare URLs become links, without the trailing punctuation', () => {
  assert.equal(inline('Hosted at **https://x.example**.'), 'Hosted at <strong><a href="https://x.example">https://x.example</a></strong>.')
})

test('repo links point at site routes, other files at GitHub', () => {
  assert.equal(resolveLink('docs/getting-started.md', '../hub/README.md'), '/docs/hub')
  assert.equal(resolveLink('docs/getting-started.md', 'configuration.md#global-config-and-accounts'), '/docs/configuration#global-config-and-accounts')
  assert.equal(resolveLink('docs/channels/README.md', '../issues.md'), '/docs/issues')
  assert.equal(resolveLink('docs/README.md', 'channels/README.md'), '/docs/channels')
  assert.equal(resolveLink('docs/on-your-own.md', '../.github/workflows/feedbai.yml'), 'https://github.com/internet4000/feedbai/blob/main/.github/workflows/feedbai.yml')
  assert.equal(resolveLink('docs/channels/README.md', '../../src/providers/'), 'https://github.com/internet4000/feedbai/tree/main/src/providers/')
  assert.equal(resolveLink('docs/x.md', 'https://bsky.app'), 'https://bsky.app')
})

test('every doc in the repo is on the site, and bundled into the Worker', () => {
  const files = ['docs', 'docs/channels'].flatMap((dir) => readdirSync(new URL(dir, root)).filter((f) => f.endsWith('.md')).map((f) => `${dir}/${f}`))
  const served = DOCS.map((d) => d.file)
  for (const file of files) assert.ok(served.includes(file), `${file} is not in DOCS (hub/site.js)`)
  const bundled = [...read('hub/docs.js').matchAll(/from '(\.\.?\/[^']+\.md)'/g)].map((m) => new URL(m[1], new URL('hub/', root)).pathname.slice(new URL(root).pathname.length))
  assert.deepEqual(bundled.sort(), [...served].sort(), 'hub/docs.js imports exactly the files in DOCS')
})

test('every page renders, and every link inside the site goes to a page', () => {
  const routes = new Set([...ways, ...DOCS.map((d) => d.route), '/favicon.svg'])
  for (const page of pages()) {
    assert.equal(page.status, 200, page.path)
    assert.match(page.html, /<title>[^<]+<\/title>/)
    for (const [, href] of page.html.matchAll(/href="(\/[^"#?]*)/g)) assert.ok(routes.has(href), `${page.path} links to ${href}, which is no page`)
  }
})

test('heading anchors used across the docs exist', () => {
  const ids = new Map(DOCS.map((d) => [d.route, new Set([...site({ path: d.route, docs }).html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]))]))
  for (const page of pages())
    for (const [, route, hash] of page.html.matchAll(/href="(\/docs[^"#]*)#([^"]+)"/g)) assert.ok(ids.get(route)?.has(hash), `${page.path} links to ${route}#${hash}, which has no such heading`)
})

test('unknown pages are a 404 page; API paths are left to the API', () => {
  assert.equal(site({ path: '/nope', docs }).status, 404)
  assert.match(site({ path: '/<x>', docs }).html, /&lt;x&gt;/)
  assert.equal(site({ path: '/v1/other', docs }), null)
  assert.equal(site({ path: '/docs/cli.md', docs }).status, 200)
})

