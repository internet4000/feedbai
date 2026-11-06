/**
 * The hub's home page: what feedbai does and how to start, for someone who has never heard of it.
 * Mobile first, one column, no external assets; light and dark follow the system.
 */
const esc = (s) => String(s ?? '').replace(/[&"<>]/g, (c) => `&#${c.charCodeAt(0)};`)

export const page = (env) => {
  const bot = esc(env.FEEDBAI_MATRIX_USER || '@feedbai:matrix.org')
  const app = esc(env.FEEDBAI_APP_URL || 'https://github.com/apps/feedbai')
  const ready = Boolean(env.FEEDBAI_APP_ID && env.FEEDBAI_APP_PRIVATE_KEY && env.FEEDBAI_MATRIX_TOKEN)
  const repo = 'https://github.com/internet4000/feedbai'
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>feedbai: user feedback, straight to your issues</title>
<meta name="description" content="People mention @feedbai in your chat; a GitHub issue appears. Free, open source, nothing to install.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
:root{--bg:#f6f8f6;--card:#fff;--ink:#10201a;--muted:#5b6b63;--line:#dfe7e2;--accent:#1f9d5c;--accent-ink:#fff;--soft:#e6f6ed;--code:#eef2ef}
@media (prefers-color-scheme:dark){:root{--bg:#0b1511;--card:#13201a;--ink:#e8f1ec;--muted:#9bb0a5;--line:#22342b;--accent:#3ddc84;--accent-ink:#0b2a1a;--soft:#173226;--code:#1b2b23}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:34rem;margin:0 auto;padding:20px 16px 48px}
a{color:inherit}
header{display:flex;align-items:center;gap:10px;margin-bottom:28px}
header img{width:36px;height:36px}
header b{font-size:20px;letter-spacing:-.01em}
.status{margin-left:auto;font-size:13px;color:var(--muted);display:flex;align-items:center;gap:6px;white-space:nowrap}
.dot{width:8px;height:8px;border-radius:50%;background:${ready ? 'var(--accent)' : '#d9822b'}}
h1{font-size:30px;line-height:1.15;letter-spacing:-.02em;margin:0 0 12px}
.lead{font-size:18px;color:var(--muted);margin:0 0 28px}
h2{font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:40px 0 12px}
.flow{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.flow li{min-width:0;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start}
.flow .icon{font-size:22px;line-height:1.3}
.flow small{display:block;color:var(--muted);font-size:14px;margin-top:2px}
.chat{display:inline-block;background:var(--soft);border-radius:12px 12px 12px 4px;padding:2px 10px;font-size:15px}
.steps{list-style:none;margin:0;padding:0;counter-reset:s;display:grid;gap:12px}
.steps li{min-width:0;counter-increment:s;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
.steps li::before{content:counter(s);display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--accent);color:var(--accent-ink);font-weight:700;font-size:15px;margin-bottom:8px}
.steps p{margin:0 0 12px}
.steps p:last-child{margin-bottom:0}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;width:100%;padding:0 16px;border-radius:12px;border:0;background:var(--accent);color:var(--accent-ink);font:600 16px/1 inherit;font-family:inherit;text-decoration:none;cursor:pointer}
.copy{min-width:0;display:flex;align-items:center;gap:8px;background:var(--code);border-radius:12px;padding:6px 6px 6px 14px;min-height:48px}
.copy code{flex:1;overflow-x:auto;white-space:nowrap;font:15px ui-monospace,SFMono-Regular,Menlo,monospace}
.copy button{flex:none;min-height:36px;padding:0 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:600 14px system-ui,sans-serif;cursor:pointer}
.note{font-size:14px;color:var(--muted)}
details{background:var(--card);border:1px solid var(--line);border-radius:14px;margin-bottom:8px}
summary{cursor:pointer;padding:14px 16px;font-weight:600;list-style:none;display:flex;justify-content:space-between;gap:12px;min-height:48px;align-items:center}
summary::-webkit-details-marker{display:none}
summary::after{content:"+";color:var(--muted);font-weight:400;font-size:22px;line-height:1}
details[open] summary::after{content:"−"}
details>div{padding:0 16px 14px;color:var(--muted);font-size:16px}
details code,.note code{background:var(--code);padding:1px 5px;border-radius:5px;font-size:.9em}
footer{margin-top:40px;font-size:14px;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px 16px}
@media (min-width:640px){main{padding-top:48px}h1{font-size:40px}}
</style>
<main>
<header>
  <img src="/favicon.svg" alt="">
  <b>feedbai</b>
  <span class="status"><span class="dot"></span>${ready ? 'Running' : 'Not configured'}</span>
</header>

<h1>Your users' feedback, straight into your issues.</h1>
<p class="lead">People already talk about your project in chat. When they mention the bot, feedbai turns their message into a GitHub issue, so you (or your AI agents) can fix it.</p>

<ol class="flow">
  <li><span class="icon">💬</span><div>Someone writes in your Matrix room<br><span class="chat">${bot} the play button doesn't work on Safari</span></div></li>
  <li><span class="icon">📋</span><div>A GitHub issue appears<small>Within 10 minutes, labelled <b>feedback</b>, with a link back to the message.</small></div></li>
  <li><span class="icon">🛠️</span><div>You or your agent fix it<small>And reply in the chat when it's done.</small></div></li>
</ol>

<h2>Set it up · 3 steps</h2>
<ol class="steps">
  <li>
    <p><b>Install the GitHub App</b> on your repository. This lets the hub open issues there.</p>
    <a class="btn" href="${app}">Install on GitHub</a>
  </li>
  <li>
    <p><b>Invite the bot</b> to your Matrix room.</p>
    <div class="copy"><code>${bot}</code><button data-copy="${bot}">Copy</button></div>
    <p class="note">The room must be public, or its topic must contain your repo's address (<code>github.com/you/repo</code>).</p>
  </li>
  <li>
    <p><b>Connect the room to your repo.</b> In your project folder, run:</p>
    <div class="copy"><code>npx github:internet4000/feedbai</code><button data-copy="npx github:internet4000/feedbai">Copy</button></div>
    <p class="note">It finds your chat rooms and tells you what to add. Commit the <code>feedbai.config.json</code> it creates. That's it.</p>
  </li>
</ol>

<h2>Questions</h2>
<details><summary>Does it cost anything?</summary><div>No. feedbai is free and open source (GPL-3.0). This hub is run by internet4000; you can also run your own.</div></details>
<details><summary>Which messages become issues?</summary><div>Only messages that mention the bot, and later replies in the same thread. Everything else stays in the chat. Messages from bots listed in your config never open issues.</div></details>
<details><summary>Does it keep my users' messages?</summary><div>No. The hub stores nothing. The issues it opens quote the messages, in your repository. Details in the <a href="${repo}/blob/main/PRIVACY.md">privacy notes</a>.</div></details>
<details><summary>How do I stop it?</summary><div>Remove the bot from your room, or uninstall the GitHub App. Either one stops it immediately.</div></details>
<details><summary>What about Bluesky and other places?</summary><div>Bluesky works too: threads become issues, and searches give you the general mood. More channels get added when a project asks: <a href="${repo}/issues/10">tell us which</a>.</div></details>
<details><summary>I'm a developer: is there an API?</summary><div>Yes, read-only and public: <code>/v1/matrix?room=#room:server</code> and <code>/v1/bluesky/search?query=…</code>. They return the same items as <code>feedbai fetch --format json</code>. The CLI uses them when you have no account of your own.</div></details>

<footer>
  <a href="${repo}">Source code</a>
  <a href="${repo}/blob/main/hub/README.md">Run your own hub</a>
  <a href="${repo}/blob/main/PRIVACY.md">Privacy</a>
  <a href="${repo}/blob/main/SECURITY.md">Security</a>
</footer>
</main>
<script>
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copy]'); if (!b) return
  try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1500) } catch {}
})
</script>
</html>`
}
