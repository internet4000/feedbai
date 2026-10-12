/**
 * feedbai hub on Cloudflare Workers: the cron trigger runs `runHub`; `/` explains how to join, `/v1/…` reads public channels for people without accounts (api.js).
 * Secrets (wrangler secret put): FEEDBAI_APP_ID, FEEDBAI_APP_PRIVATE_KEY, FEEDBAI_MATRIX_TOKEN,
 * optional FEEDBAI_BLUESKY_IDENTIFIER/_PASSWORD. Vars (../wrangler.jsonc): FEEDBAI_MATRIX_USER, FEEDBAI_APP_URL.
 */
import { runHub } from './run.js'
import { readMatrix, readBlueskySearch } from './api.js'

const page = (env) => `<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>feedbai hub</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem}code{background:#8882;padding:0 .2em}</style>
<h1>feedbai hub</h1>
<p>Reads what users say about your project where they already talk, and files what is addressed to it as GitHub issues (label <code>feedback</code>) that your agents can pick up. No bot account, secrets or server of your own.</p>
<table>
<tr><th>Channel</th><th>Read with <code>npx feedbai</code>, no account</th><th>Filed as issues</th></tr>
<tr><td>Matrix room</td><td>public rooms the bot <code>${env.FEEDBAI_MATRIX_USER}</code> was invited to</td><td>threads that mention the bot</td></tr>
<tr><td>Bluesky search</td><td>yes (<code>feedbai add bluesky search '#yourproject'</code>)</td><td>no: read for the general sentiment</td></tr>
<tr><td>Bluesky thread</td><td>yes (public)</td><td>yes</td></tr>
</table>
<p>More channels as projects ask for them: <a href="https://github.com/internet4000/feedbai/issues/10">which ones next?</a></p>
<h2>Set up</h2>
<ol>
<li>Add your channels and commit <code>feedbai.config.json</code>: <code>npx feedbai</code> in the repo finds them and prints the <code>feedbai add …</code> commands.</li>
<li>For a Matrix room, invite <code>${env.FEEDBAI_MATRIX_USER}</code>. It must be public, or its topic must name your repo (<code>github.com/owner/repo</code>). Kick the bot to stop.</li>
<li>To get issues, install the <a href="${env.FEEDBAI_APP_URL}">feedbai GitHub App</a> on your repo. Issues appear within about 10 minutes.</li>
</ol>
<p>API: <code>/v1/matrix?room=#room:server</code>, <code>/v1/bluesky/search?query=…</code>, same items as <code>feedbai fetch --format json</code>.</p>
<p><a href="https://github.com/internet4000/feedbai">github.com/internet4000/feedbai</a></p>
`

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/') return new Response(page(env), { headers: { 'content-type': 'text/html; charset=utf-8' } })
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
