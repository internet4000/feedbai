/**
 * feedbai hub on Cloudflare Workers: the cron trigger runs `runHub`; `/v1/…` reads public channels for people without accounts (api.js).
 * Everything else is the website (site/, Astro + Starlight, static files); unknown paths get its 404 page.
 * Secrets (wrangler secret put): FEEDBAI_APP_ID, FEEDBAI_APP_PRIVATE_KEY, FEEDBAI_MATRIX_TOKEN,
 * optional FEEDBAI_BLUESKY_IDENTIFIER/_PASSWORD. Vars (../wrangler.jsonc): FEEDBAI_MATRIX_USER, FEEDBAI_APP_URL.
 */
import { runHub } from './run.js'
import { readMatrix, readBlueskySearch } from './api.js'

/** The site's own 404 page, with a 404 status. */
const notFound = async (request, env) => {
  const page = env.ASSETS && (await env.ASSETS.fetch(new URL('/404.html', request.url)))
  return page?.ok ? new Response(page.body, { status: 404, headers: page.headers }) : new Response('Not found', { status: 404 })
}

/**
 * The sign-in page ("save to my Bluesky account", site/src/pages/connect.astro) lives alone on its own origin,
 * FEEDBAI_AUTH_HOST: its sessions can't be reached from the rest of the site, and it can't be framed.
 */
const AUTH_PATHS = /^\/(connect\/.*|oauth\/client-metadata\.json|_astro\/.+|favicon\.svg)$/
const AUTH_HEADERS = {
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
}

/** The website's static files (site/dist); the auth origin gets only its own pages, with strict headers. */
const site = async (request, env, url) => {
  const auth = env.FEEDBAI_AUTH_HOST
  const onAuth = auth && url.hostname === auth
  if (auth && !onAuth && /^\/(connect\/|oauth\/)/.test(url.pathname)) return Response.redirect(`https://${auth}${url.pathname}${url.search}`, 302)
  if (onAuth && !AUTH_PATHS.test(url.pathname)) {
    if (url.pathname === '/connect') return Response.redirect(`https://${auth}/connect/${url.search}`, 302)
    return Response.redirect(`https://${url.hostname.replace(/^auth\./, '')}${url.pathname}${url.search}`, 302)
  }
  const response = await env.ASSETS.fetch(request)
  if (response.status === 404) return notFound(request, env)
  if (!onAuth) return response
  const secured = new Response(response.body, response)
  for (const [name, value] of Object.entries(AUTH_HEADERS)) secured.headers.set(name, value)
  return secured
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    // The hub's domain is its Bluesky bot's handle (AT Protocol handle verification over HTTPS)
    if (url.pathname === '/.well-known/atproto-did' && env.FEEDBAI_BLUESKY_DID) return new Response(env.FEEDBAI_BLUESKY_DID, { headers: { 'content-type': 'text/plain' } })
    const read = { '/v1/matrix': readMatrix, '/v1/bluesky/search': readBlueskySearch }[url.pathname]
    if (!read) return env.ASSETS ? site(request, env, url) : notFound(request, env)
    if (request.method !== 'GET') return notFound(request, env)
    // Public data, cached briefly so a busy room costs one Matrix read per minute
    const cached = await caches.default.match(request)
    if (cached) return cached
    const response = await read({ params: url.searchParams, env })
    if (response.ok) ctx.waitUntil(caches.default.put(request, response.clone()))
    return response
  },
  async scheduled(controller, env, ctx) {
    const missing = ['FEEDBAI_APP_ID', 'FEEDBAI_APP_PRIVATE_KEY', 'FEEDBAI_MATRIX_TOKEN'].filter((name) => !env[name])
    if (missing.length) return console.log(`feedbai hub: not configured, missing secrets ${missing.join(', ')}`)
    ctx.waitUntil(runHub({ env }))
  },
}
