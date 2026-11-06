/**
 * feedbai hub on Cloudflare Workers: the cron trigger runs `runHub`; `/v1/…` reads public channels for people without accounts (api.js).
 * The website (site/, Astro + Starlight) is static assets served before this code runs; unknown paths get its 404 page.
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    // The hub's domain is its Bluesky bot's handle (AT Protocol handle verification over HTTPS)
    if (url.pathname === '/.well-known/atproto-did' && env.FEEDBAI_BLUESKY_DID) return new Response(env.FEEDBAI_BLUESKY_DID, { headers: { 'content-type': 'text/plain' } })
    const read = { '/v1/matrix': readMatrix, '/v1/bluesky/search': readBlueskySearch }[url.pathname]
    if (!read || request.method !== 'GET') return notFound(request, env)
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
