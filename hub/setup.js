#!/usr/bin/env node
/**
 * Set up a hub's secrets from a local page: create its GitHub App (manifest flow), log its
 * Matrix bot in, and store its Bluesky app password. Secrets go straight into `wrangler secret put`; nothing is printed or saved.
 * Usage: node hub/setup.js --url https://feedbai.internet4000.com [--owner <github org>] [--name feedbai]
 */
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { providers } from '../src/providers/index.js'

const { values: args } = parseArgs({
  options: { url: { type: 'string' }, owner: { type: 'string' }, name: { type: 'string', default: 'feedbai' }, port: { type: 'string', default: '8977' } },
})
if (!args.url) throw new Error('--url <hub url> is required, e.g. --url https://feedbai.internet4000.com')

process.on('exit', (code) => code && console.error(`setup exited with code ${code}`))
process.on('uncaughtException', (error) => console.error(`setup crashed: ${error.stack}`))

const ROOT = fileURLToPath(new URL('..', import.meta.url)) // wrangler.jsonc lives at the repo root
const local = `http://localhost:${args.port}`
const state = randomBytes(16).toString('hex')
const escape = (s) => String(s).replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`)

/** Pipe a value into `wrangler secret put` for the hub Worker; never echoed. */
const putSecret = (name, value) =>
  new Promise((resolve, reject) => {
    const child = spawn('npx', ['-y', 'wrangler@4', 'secret', 'put', name], { cwd: ROOT, stdio: ['pipe', 'inherit', 'inherit'] })
    child.on('error', reject)
    child.stdin.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`wrangler secret put ${name} exited with ${code}`))))
    child.stdin.end(value)
  })

const manifest = {
  name: args.name,
  url: args.url,
  description: 'Turns user feedback from Matrix rooms and Bluesky into GitHub issues for your agents.',
  public: true,
  redirect_url: `${local}/github/callback`,
  hook_attributes: { url: `${args.url}/github/webhook`, active: false },
  // Not "contents": the hub reads one file. A manifest can't set the single-file path, so step 1 says to add it
  default_permissions: { issues: 'write', metadata: 'read' },
  default_events: [],
}
const newAppUrl = args.owner
  ? `https://github.com/organizations/${args.owner}/settings/apps/new?state=${state}`
  : `https://github.com/settings/apps/new?state=${state}`

const html = (body) => `<!doctype html><meta charset="utf-8"><title>feedbai hub setup</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:36rem;margin:2rem auto;padding:0 1rem}input,button{font:inherit;margin:.2rem 0}</style>
<h1>feedbai hub setup</h1>${body}`

const home = () => html(`
<h2>1. GitHub App</h2>
<form action="${escape(newAppUrl)}" method="post">
<input type="hidden" name="manifest" value="${escape(JSON.stringify(manifest))}">
<p>Creates the <b>${escape(args.name)}</b> App${args.owner ? ` under <b>${escape(args.owner)}</b>` : ''} (Issues: write, no webhook).</p>
<button>Create GitHub App</button></form>
<p>Then, in the new App's settings → Permissions &amp; events → Repository permissions, set <b>Single file: Read-only</b> with the path <code>feedbai.config.json</code>. The hub reads only that file, never the repository's code.</p>
<h2>2. Matrix bot</h2>
<form action="/matrix" method="post"><input type="hidden" name="state" value="${state}">
<p>Paste an access token for the bot, or log it in once with its password (only a new token, device "feedbai", is stored).</p>
<p>To get a token without sharing the password: log in as the bot in a private window of a Matrix client (e.g. app.element.io), copy Settings → Help &amp; About → Access token, then <b>close the window without logging out</b> (logging out revokes the token).</p>
<input name="token" type="password" placeholder="access token" size="30"> or<br>
<input name="user" placeholder="@feedbai:matrix.org" size="30"><br>
<input name="password" type="password" placeholder="password" size="30"><br>
<input name="homeserver" value="https://matrix.org" size="30"><br>
<button>Log in bot</button></form>
<h2>3. Bluesky account (optional)</h2>
<form action="/bluesky" method="post"><input type="hidden" name="state" value="${state}">
<p>Lets people search Bluesky through the hub without an account. Use an app password (bsky.app → Settings → Privacy and security → App passwords). Set the handle as FEEDBAI_BLUESKY_IDENTIFIER in wrangler.jsonc.</p>
<input name="identifier" placeholder="feedbai.internet4000.com" required size="30"><br>
<input name="password" type="password" placeholder="app password" required size="30"><br>
<button>Store app password</button></form>`)

/** Form fields, only from this page: any website could otherwise post its own bot credentials here (CSRF). */
const readForm = async (req) => {
  let body = ''
  for await (const chunk of req) body += chunk
  const form = Object.fromEntries(new URLSearchParams(body))
  if (form.state !== state) throw new Error('state mismatch: start again from the setup page')
  return form
}

/**
 * Rotation: after a new login, sign out the bot's other "feedbai" sessions, so the token they held stops working.
 * Matrix asks for the password again to delete devices (user-interactive auth).
 */
const signOutOldSessions = async (homeserver, token, user, password) => {
  const base = `${homeserver.replace(/\/$/, '')}/_matrix/client/v3`
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  const { device_id: current } = await (await fetch(`${base}/account/whoami`, { headers })).json()
  const { devices = [] } = await (await fetch(`${base}/devices`, { headers })).json()
  const old = devices.filter((d) => d.display_name === 'feedbai' && d.device_id !== current).map((d) => d.device_id)
  if (!old.length) return 0
  const first = await fetch(`${base}/delete_devices`, { method: 'POST', headers, body: JSON.stringify({ devices: old }) })
  const { session } = await first.json()
  const auth = { type: 'm.login.password', identifier: { type: 'm.id.user', user }, password, session }
  const res = await fetch(`${base}/delete_devices`, { method: 'POST', headers, body: JSON.stringify({ devices: old, auth }) })
  if (!res.ok) throw new Error(`Couldn't sign out the old sessions: ${res.status} ${await res.text()}`)
  return old.length
}

/** Checks a pasted Matrix access token and returns whose it is. */
const matrixWhoami = async (homeserver, token) => {
  const res = await fetch(`${homeserver.replace(/\/$/, '')}/_matrix/client/v3/account/whoami`, { headers: { authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`Matrix rejected the token: ${res.status} ${await res.text()}`)
  return (await res.json()).user_id
}

const routes = {
  'GET /': async () => home(),
  'GET /github/callback': async (req, url) => {
    if (url.searchParams.get('state') !== state) throw new Error('state mismatch: start again from the setup page')
    const res = await fetch(`https://api.github.com/app-manifests/${encodeURIComponent(url.searchParams.get('code'))}/conversions`, {
      method: 'POST',
      headers: { accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(`GitHub manifest conversion failed: ${res.status} ${await res.text()}`)
    const app = await res.json()
    console.log(`GitHub App ${app.slug} (id ${app.id}) created, storing its secrets…`)
    await putSecret('FEEDBAI_APP_ID', String(app.id))
    await putSecret('FEEDBAI_APP_PRIVATE_KEY', app.pem)
    console.log(`GitHub App created: ${app.html_url} (id ${app.id}). Set FEEDBAI_APP_URL to ${app.html_url} in wrangler.jsonc.`)
    return html(`<p>Created <a href="${escape(app.html_url)}">${escape(app.slug)}</a> and stored its id and key in the Worker.</p><p><a href="/">Back</a></p>`)
  },
  'POST /bluesky': async (req) => {
    const { identifier, password } = await readForm(req)
    const { handle } = await providers.bluesky.login({ identifier, password })
    await putSecret('FEEDBAI_BLUESKY_PASSWORD', password)
    console.log(`Bluesky ${handle}: app password stored. FEEDBAI_BLUESKY_IDENTIFIER should be ${handle}.`)
    return html(`<p>Stored the app password for <b>${escape(handle)}</b>.</p><p><a href="/">Back</a></p>`)
  },
  'POST /matrix': async (req) => {
    const { user, password, homeserver, token: pasted } = await readForm(req)
    const { token, user: userId } = pasted
      ? { token: pasted, user: await matrixWhoami(homeserver, pasted) }
      : await providers.matrix.login({ homeserver, user, password })
    await putSecret('FEEDBAI_MATRIX_TOKEN', token)
    // The old token is revoked only once the new one is in place
    const revoked = pasted ? 0 : await signOutOldSessions(homeserver, token, userId, password)
    console.log(`Matrix bot ${userId} logged in; token stored${revoked ? `, ${revoked} old session(s) signed out` : ''}. FEEDBAI_MATRIX_USER should be ${userId}.`)
    const note = pasted
      ? '<p>To revoke the old token: in a Matrix client logged in as the bot, Settings → Sessions, sign out the older "feedbai" sessions.</p>'
      : `<p>${revoked} old "feedbai" session(s) signed out: their tokens no longer work.</p>`
    return html(`<p>Stored a token for <b>${escape(userId)}</b>.</p>${note}<p><a href="/">Back</a></p>`)
  },
}

createServer(async (req, res) => {
  const url = new URL(req.url, local)
  const route = routes[`${req.method} ${url.pathname}`]
  // Another Host means another site reached us through DNS rebinding
  if (req.headers.host !== `localhost:${args.port}` && req.headers.host !== `127.0.0.1:${args.port}`) return res.writeHead(421).end('Misdirected request')
  try {
    if (!route) return res.writeHead(404).end('Not found')
    const body = await route(req, url) // before writeHead, so a failing route can still answer 500
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(body)
  } catch (error) {
    console.error(error.message)
    res.writeHead(500, { 'content-type': 'text/html; charset=utf-8' }).end(html(`<p>${escape(error.message)}</p><p><a href="/">Back</a></p>`))
  }
}).listen(Number(args.port), '127.0.0.1', () => console.log(`Open ${local} to set up the hub secrets (Ctrl-C when done).`))
