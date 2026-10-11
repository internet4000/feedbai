/**
 * feedbai hub on Cloudflare Workers: the cron trigger runs `runHub`; `/` explains how to join, `/v1/matrix` serves public rooms (api.js).
 * Secrets (wrangler secret put): FEEDBAI_APP_ID, FEEDBAI_APP_PRIVATE_KEY, FEEDBAI_MATRIX_TOKEN,
 * optional FEEDBAI_BLUESKY_IDENTIFIER/_PASSWORD. Vars (../wrangler.jsonc): FEEDBAI_MATRIX_USER, FEEDBAI_APP_URL.
 */
import { runHub } from './run.js'
import { readMatrix } from './api.js'

const page = (env) => `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>feedbai hub</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem}code{background:#8882;padding:0 .2em}</style>
<h1>feedbai hub</h1>
<p>Turns user feedback from your project's Matrix room into GitHub issues (label <code>feedback</code>) that your agents can pick up. No bot account, secrets or server of your own.</p>
<ol>
<li>Invite <code>${env.FEEDBAI_MATRIX_USER}</code> to your room. The room must be public, or its topic must name your repo (<code>github.com/owner/repo</code>).</li>
<li>Install the <a href="${env.FEEDBAI_APP_URL}">feedbai GitHub App</a> on your repo.</li>
<li>Commit <code>feedbai.config.json</code>: <code>npx feedbai add matrix '#room:server'</code></li>
</ol>
<p>Messages that mention the bot become issues within about 10 minutes. Kick the bot to stop.</p>
<p>Once the bot is in a public room, anyone can read it with <code>npx feedbai</code> in the repo, no Matrix account needed (API: <code>/v1/matrix?room=#room:server</code>).</p>
<p><a href="https://github.com/internet4000/feedbai">github.com/internet4000/feedbai</a></p>
`

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/') return new Response(page(env), { headers: { 'content-type': 'text/html; charset=utf-8' } })
    if (url.pathname !== '/v1/matrix' || request.method !== 'GET') return new Response('Not found', { status: 404 })
    // Public data, cached briefly so a busy room costs one Matrix read per minute
    const cached = await caches.default.match(request)
    if (cached) return cached
    const response = await readMatrix({ params: url.searchParams, env })
    if (response.ok) ctx.waitUntil(caches.default.put(request, response.clone()))
    return response
  },
  async scheduled(controller, env, ctx) {
    const missing = ['FEEDBAI_APP_ID', 'FEEDBAI_APP_PRIVATE_KEY', 'FEEDBAI_MATRIX_TOKEN'].filter((name) => !env[name])
    if (missing.length) return console.log(`feedbai hub: not configured, missing secrets ${missing.join(', ')}`)
    ctx.waitUntil(runHub({ env }))
  },
}
