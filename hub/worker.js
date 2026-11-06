/**
 * feedbai hub on Cloudflare Workers: the cron trigger runs `runHub`; `/` explains how to join, `/v1/…` reads public channels for people without accounts (api.js).
 * Secrets (wrangler secret put): FEEDBAI_APP_ID, FEEDBAI_APP_PRIVATE_KEY, FEEDBAI_MATRIX_TOKEN,
 * optional FEEDBAI_BLUESKY_IDENTIFIER/_PASSWORD. Vars (../wrangler.jsonc): FEEDBAI_MATRIX_USER, FEEDBAI_APP_URL.
 */
import { runHub } from './run.js'
import { readMatrix, readBlueskySearch } from './api.js'
import logo from '../assets/logo.svg'
import { page } from './page.js'


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/favicon.svg') return new Response(logo, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } })
    if (url.pathname === '/') return new Response(page(env), { headers: { 'content-type': 'text/html; charset=utf-8' } })
    // The hub's domain is its Bluesky bot's handle (AT Protocol handle verification over HTTPS)
    if (url.pathname === '/.well-known/atproto-did' && env.FEEDBAI_BLUESKY_DID) return new Response(env.FEEDBAI_BLUESKY_DID, { headers: { 'content-type': 'text/plain' } })
    const read = { '/v1/matrix': readMatrix, '/v1/bluesky/search': readBlueskySearch }[url.pathname]
    if (!read || request.method !== 'GET') return new Response('Not found', { status: 404 })
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
