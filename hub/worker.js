/**
 * feedbai hub on Cloudflare Workers: the cron trigger runs `runHub`; `/v1/…` reads public channels for people without accounts (api.js);
 * every other page is the website (site.js): the ways to use feedbai, and the repo's docs at /docs.
 * Secrets (wrangler secret put): FEEDBAI_APP_ID, FEEDBAI_APP_PRIVATE_KEY, FEEDBAI_MATRIX_TOKEN,
 * optional FEEDBAI_BLUESKY_IDENTIFIER/_PASSWORD. Vars (../wrangler.jsonc): FEEDBAI_MATRIX_USER, FEEDBAI_APP_URL.
 */
import { runHub } from './run.js'
import { readMatrix, readBlueskySearch } from './api.js'
import logo from '../assets/logo.svg'
import { site, MERMAID_PATH, MERMAID_CDN } from './site.js'
import { docs } from './docs.js'

/** A pinned file from a CDN, served from this domain (visitors never contact the CDN), cached for a day. */
const vendor = async (request, upstream, ctx) => {
  if (!/^[\w./-]+\.m?js$/.test(upstream.slice(upstream.lastIndexOf('/dist/') + 6)) || upstream.includes('..')) return new Response('Not found', { status: 404 })
  const cached = await caches.default.match(request)
  if (cached) return cached
  const res = await fetch(upstream)
  if (!res.ok) return new Response('Not found', { status: 404 })
  const response = new Response(res.body, { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'public, max-age=86400' } })
  ctx.waitUntil(caches.default.put(request, response.clone()))
  return response
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/favicon.svg') return new Response(logo, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=86400' } })
    // The hub's domain is its Bluesky bot's handle (AT Protocol handle verification over HTTPS)
    if (url.pathname === '/.well-known/atproto-did' && env.FEEDBAI_BLUESKY_DID) return new Response(env.FEEDBAI_BLUESKY_DID, { headers: { 'content-type': 'text/plain' } })
    if (url.pathname.startsWith(MERMAID_PATH)) return vendor(request, MERMAID_CDN + url.pathname.slice(MERMAID_PATH.length), ctx)
    const read = { '/v1/matrix': readMatrix, '/v1/bluesky/search': readBlueskySearch }[url.pathname]
    if (!read) {
      const page = request.method === 'GET' || request.method === 'HEAD' ? site({ path: url.pathname, env, docs }) : null
      if (!page) return new Response('Not found', { status: 404 })
      return new Response(page.html, { status: page.status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } })
    }
    if (request.method !== 'GET') return new Response('Not found', { status: 404 })
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
