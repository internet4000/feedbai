import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker from '../hub/worker.js'

const files = { '/': 'home', '/connect/': 'sign in', '/oauth/client-metadata.json': '{}', '/_astro/x.js': 'js', '/docs/': 'docs', '/404.html': 'not found page', '/embed.js': 'button' }
const env = {
  FEEDBAI_AUTH_HOST: 'auth.feedbai.example',
  ASSETS: { fetch: async (req) => { const path = new URL(req.url ?? req).pathname; return path in files ? new Response(files[path]) : new Response('', { status: 404 }) } },
}
const get = (url) => worker.fetch(new Request(url), env, { waitUntil() {} })

test('the sign-in page lives alone on its own origin, with strict headers', async () => {
  const page = await get('https://auth.feedbai.example/connect/?project=o/r')
  assert.equal(page.status, 200)
  assert.equal(await page.text(), 'sign in')
  assert.match(page.headers.get('content-security-policy'), /script-src 'self';.*frame-ancestors 'none'/)
  assert.equal(page.headers.get('x-frame-options'), 'DENY')
  assert.equal((await get('https://auth.feedbai.example/oauth/client-metadata.json')).status, 200)
  assert.equal((await get('https://auth.feedbai.example/_astro/x.js')).status, 200)
  // Nothing else of the site on that origin
  const docs = await get('https://auth.feedbai.example/docs/')
  assert.equal(docs.status, 302)
  assert.equal(docs.headers.get('location'), 'https://feedbai.example/docs/')
})

test('the main site sends sign-in to the auth origin, and serves the rest without those headers', async () => {
  const connect = await get('https://feedbai.example/connect/?text=hi')
  assert.equal(connect.status, 302)
  assert.equal(connect.headers.get('location'), 'https://auth.feedbai.example/connect/?text=hi')
  const docs = await get('https://feedbai.example/docs/')
  assert.equal(await docs.text(), 'docs')
  assert.equal(docs.headers.get('content-security-policy'), null)
  const missing = await get('https://feedbai.example/nope')
  assert.equal(missing.status, 404)
  assert.equal(await missing.text(), 'not found page')
})

test('other sites can load the Feedback button as a module script (CORS), and only that file', async () => {
  const button = await get('https://feedbai.example/embed.js')
  assert.equal(await button.text(), 'button')
  assert.equal(button.headers.get('access-control-allow-origin'), '*')
  assert.equal((await get('https://feedbai.example/docs/')).headers.get('access-control-allow-origin'), null)
})
