/**
 * The hub's website: `/` and its tabs show each way to use feedbai, `/docs/…` serves the repo's docs
 * (rendered from the same Markdown as on GitHub, so they never drift). Mobile first, one column,
 * no external assets except Mermaid on pages with diagrams; light and dark follow the system.
 */
import { esc, render } from './markdown.js'

const REPO = 'https://github.com/internet4000/feedbai'

/** Every doc the site serves: repo path → route, in menu order. Links between docs follow these. */
export const DOCS = [
  { group: 'Start', file: 'docs/README.md', route: '/docs', label: 'Overview' },
  { group: 'Start', file: 'docs/getting-started.md', route: '/docs/getting-started' },
  { group: 'Start', file: 'docs/concepts.md', route: '/docs/concepts' },
  { group: 'Start', file: 'docs/agents.md', route: '/docs/agents' },
  { group: 'Start', file: 'docs/issues.md', route: '/docs/issues' },
  { group: 'Start', file: 'docs/on-your-own.md', route: '/docs/on-your-own' },
  { group: 'Reference', file: 'docs/cli.md', route: '/docs/cli' },
  { group: 'Reference', file: 'docs/configuration.md', route: '/docs/configuration' },
  { group: 'Reference', file: 'docs/channels/README.md', route: '/docs/channels' },
  { group: 'Reference', file: 'docs/channels/matrix.md', route: '/docs/channels/matrix' },
  { group: 'Reference', file: 'docs/channels/bluesky.md', route: '/docs/channels/bluesky' },
  { group: 'Reference', file: 'docs/channels/github.md', route: '/docs/channels/github' },
  { group: 'Reference', file: 'hub/README.md', route: '/docs/hub' },
  { group: 'Project', file: 'docs/vision.md', route: '/docs/vision', label: 'Vision' },
  { group: 'Project', file: 'docs/channels/adding-a-channel.md', route: '/docs/channels/adding-a-channel' },
  { group: 'Project', file: 'docs/development.md', route: '/docs/development' },
  { group: 'Project', file: 'PRIVACY.md', route: '/docs/privacy' },
  { group: 'Project', file: 'SECURITY.md', route: '/docs/security' },
]

/** A link written in a repo file, as the site serves it: another doc → its route; any other repo file → GitHub. */
export const resolveLink = (from, href) => {
  if (/^[a-z][a-z+.-]*:/i.test(href) || href.startsWith('#') || href.startsWith('//')) return href
  const url = new URL(href, `https://repo.invalid/${from}`)
  const path = decodeURIComponent(url.pathname.slice(1))
  const doc = DOCS.find((d) => d.file === path || d.file === `${path.replace(/\/$/, '')}/README.md`)
  if (doc) return doc.route + url.hash
  return `${REPO}/${path.endsWith('/') || !/\.\w+$/.test(path) ? 'tree' : 'blob'}/main/${path}${url.hash}`
}

const copy = (text) => `<div class="copy"><code>${esc(text)}</code><button type="button" data-copy="${esc(text)}">Copy</button></div>`
const chat = (text) => `<span class="chat">${esc(text)}</span>`

/** The ways to use feedbai, one tab each. Steps are HTML (built from escaped values only). */
const ways = (env) => {
  const bot = env.FEEDBAI_MATRIX_USER || '@feedbai:matrix.org'
  const app = env.FEEDBAI_APP_URL || 'https://github.com/apps/feedbai'
  return [
    {
      path: '/',
      tab: 'Hosted',
      hint: 'easiest',
      title: 'Hosted: nothing to run',
      lead: 'Our hub reads your chat and opens the issues. You install an App and invite a bot.',
      steps: [
        `<p><b>Install the GitHub App</b> on your repository. This lets the hub open issues there.</p><a class="btn" href="${esc(app)}">Install on GitHub</a>`,
        `<p><b>Invite the bot</b> to your Matrix room.</p>${copy(bot)}<p class="note">The room must be public, or its topic must contain your repo's address (<code>github.com/you/repo</code>).</p>`,
        `<p><b>Connect the room to your repo.</b> In your project folder, run:</p>${copy('npx github:internet4000/feedbai')}<p class="note">It finds your chat rooms and tells you what to add. Commit the <code>feedbai.config.json</code> it creates. That's it.</p>`,
      ],
      more: ['/docs/getting-started', 'Getting started guide'],
    },
    {
      path: '/agent',
      tab: 'With your AI agent',
      title: 'With your AI agent',
      lead: 'Claude Code, Codex or any agent that runs commands reads the feedback, files issues, opens fixes and replies.',
      steps: [
        `<p><b>Install feedbai</b> (Node 22 or later, no dependencies).</p>${copy('npm i -g github:internet4000/feedbai')}`,
        `<p><b>Run it in your project.</b> It finds your channels and prints what to add; commit <code>feedbai.config.json</code>.</p>${copy('feedbai')}`,
        `<p><b>Hand it to your agent.</b> In Claude Code type <code>!feedbai</code>, or ask “check user feedback”. To keep listening while it works:</p>${copy('feedbai watch --as claude')}`,
      ],
      more: ['/docs/agents', 'Agents and the triage workflow'],
    },
    {
      path: '/diy',
      tab: 'Without our servers',
      title: 'Without our servers',
      lead: 'Your own bot accounts, your own CI. Nothing goes through internet4000.',
      steps: [
        `<p><b>Make a bot account</b> for your project on Matrix (and Bluesky if you want), invite it to your room, then log it in from your terminal:</p>${copy('feedbai login matrix --user @yourproject-bot:matrix.org')}`,
        `<p><b>Never fall back to our hub.</b> Add to your shell profile:</p>${copy('export FEEDBAI_HUB=off')}`,
        `<p><b>File issues from your CI.</b> Copy the workflow into your repo and add the bot's token as a secret.</p><a class="btn ghost" href="${REPO}/blob/main/.github/workflows/feedbai.yml">Get the workflow</a>`,
      ],
      more: ['/docs/on-your-own', 'Step-by-step guide'],
    },
    {
      path: '/self-host',
      tab: 'Run your own hub',
      title: 'Run your own hub',
      lead: 'One bot shared by your projects, team or community. A Cloudflare Worker, or any cron job. Free software, no database.',
      steps: [
        `<p><b>Deploy it.</b> In a clone of feedbai, set your domain and account in <code>wrangler.jsonc</code>, then:</p>${copy('npx wrangler@4 deploy')}`,
        `<p><b>Create its GitHub App and log its bot in</b> from a local page; secrets go straight into the Worker:</p>${copy('node hub/setup.js --url https://your-hub.example --owner your-org')}`,
        `<p><b>Point people at it.</b></p>${copy('export FEEDBAI_HUB=https://your-hub.example')}`,
      ],
      more: ['/docs/hub', 'The hub: rules and running your own'],
    },
    {
      path: '/give',
      tab: 'Give feedback',
      title: 'Give feedback on a project',
      lead: 'You use a project that has feedbai. Tell its makers what works and what doesn\'t, where you already are.',
      steps: [
        `<p><b>Join the project's chat room.</b> It's usually linked from its website or README. Any Matrix app works, for example <a href="https://app.element.io">Element</a>.</p>`,
        `<p><b>Write your message and mention the bot.</b></p><p>${chat(`${bot} the play button doesn't work on Safari`)}</p>`,
        `<p><b>That's it.</b> It becomes an issue the maintainers see, linked to your message. They reply in the thread when it's fixed.</p>`,
      ],
      more: ['/docs/vision', 'Where this is going: feedback on any site'],
    },
  ]
}

const CSS = `
:root{--bg:#f6f8f6;--card:#fff;--ink:#10201a;--muted:#5b6b63;--line:#dfe7e2;--accent:#1f9d5c;--accent-ink:#fff;--soft:#e6f6ed;--code:#eef2ef}
@media (prefers-color-scheme:dark){:root{--bg:#0b1511;--card:#13201a;--ink:#e8f1ec;--muted:#9bb0a5;--line:#22342b;--accent:#3ddc84;--accent-ink:#0b2a1a;--soft:#173226;--code:#1b2b23}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-padding-top:72px}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:inherit}
.top{position:sticky;top:0;z-index:2;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.top>div{max-width:60rem;margin:0 auto;padding:0 16px;height:56px;display:flex;align-items:center;gap:4px}
.brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:19px;text-decoration:none;margin-right:auto}
.brand img{width:28px;height:28px}
.top nav a{text-decoration:none;padding:10px 12px;border-radius:10px;font-size:15px;font-weight:600;color:var(--muted)}
.top nav a[aria-current]{color:var(--ink);background:var(--card)}
main{max-width:34rem;margin:0 auto;padding:24px 16px 48px}
.status{font-size:13px;color:var(--muted);display:inline-flex;align-items:center;gap:6px}
.dot{width:8px;height:8px;border-radius:50%;background:var(--accent)}
.dot.off{background:#d9822b}
h1{font-size:30px;line-height:1.15;letter-spacing:-.02em;margin:0 0 12px}
.lead{font-size:18px;color:var(--muted);margin:0 0 24px}
.label{font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:36px 0 12px;font-weight:700}
.flow{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.flow li{min-width:0;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start}
.flow .icon{font-size:22px;line-height:1.3}
.flow small{display:block;color:var(--muted);font-size:14px;margin-top:2px}
.chat{display:inline-block;background:var(--soft);border-radius:12px 12px 12px 4px;padding:2px 10px;font-size:15px}
.tabs{display:flex;gap:8px;overflow-x:auto;margin:0 -16px 16px;padding:2px 16px 6px;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tabs a{flex:none;display:flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border-radius:999px;border:1px solid var(--line);background:var(--card);text-decoration:none;font-size:15px;font-weight:600;white-space:nowrap}
.tabs a small{font-weight:500;color:var(--muted)}
.tabs a[aria-current]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
.tabs a[aria-current] small{color:inherit;opacity:.75}
.way h2{font-size:22px;margin:0 0 4px;letter-spacing:-.01em}
.way>p{color:var(--muted);margin:0 0 16px}
.steps{list-style:none;margin:0;padding:0;counter-reset:s;display:grid;gap:12px}
.steps li{min-width:0;counter-increment:s;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px}
.steps li::before{content:counter(s);display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:var(--accent);color:var(--accent-ink);font-weight:700;font-size:15px;margin-bottom:8px}
.steps p{margin:0 0 12px}
.steps p:last-child{margin-bottom:0}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;min-height:48px;width:100%;padding:0 16px;border-radius:12px;border:0;background:var(--accent);color:var(--accent-ink);font:600 16px/1 inherit;font-family:inherit;text-decoration:none;cursor:pointer}
.btn.ghost{background:var(--card);color:var(--ink);border:1px solid var(--line)}
.more{display:block;margin-top:14px;font-weight:600;text-decoration:none;color:var(--accent)}
.copy{min-width:0;display:flex;align-items:center;gap:8px;background:var(--code);border-radius:12px;padding:6px 6px 6px 14px;min-height:48px}
.copy code{flex:1;overflow-x:auto;white-space:nowrap;font:15px ui-monospace,SFMono-Regular,Menlo,monospace}
.copy button,pre button{flex:none;min-height:36px;padding:0 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);font:600 14px system-ui,sans-serif;cursor:pointer}
.note{font-size:14px;color:var(--muted)}
.note code,.steps code{background:var(--code);padding:1px 5px;border-radius:5px;font-size:.9em}
details.faq{background:var(--card);border:1px solid var(--line);border-radius:14px;margin-bottom:8px}
.faq summary{cursor:pointer;padding:14px 16px;font-weight:600;list-style:none;display:flex;justify-content:space-between;gap:12px;min-height:48px;align-items:center}
summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";color:var(--muted);font-weight:400;font-size:22px;line-height:1}
.faq[open] summary::after{content:"−"}
.faq>div{padding:0 16px 14px;color:var(--muted);font-size:16px}
.faq code{background:var(--code);padding:1px 5px;border-radius:5px;font-size:.9em}
footer{max-width:60rem;margin:0 auto;padding:24px 16px 40px;font-size:14px;color:var(--muted);display:flex;flex-wrap:wrap;gap:6px 16px;border-top:1px solid var(--line)}
/* docs */
.docs{max-width:60rem}
.menu{border:1px solid var(--line);background:var(--card);border-radius:14px;margin-bottom:20px}
.menu summary{cursor:pointer;list-style:none;padding:12px 16px;min-height:48px;display:flex;align-items:center;justify-content:space-between;font-weight:600}
.menu summary::after{content:"☰";color:var(--muted)}
.menu nav{padding:0 8px 8px}
.menu b{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);padding:12px 8px 4px}
.menu a{display:block;padding:8px;border-radius:8px;text-decoration:none;font-size:15px}
.menu a[aria-current]{background:var(--soft);font-weight:600}
article{min-width:0;font-size:16.5px}
article h1{font-size:32px}
article h2{font-size:23px;margin:36px 0 10px;letter-spacing:-.01em}
article h3{font-size:19px;margin:28px 0 8px}
article .anchor{text-decoration:none;color:var(--muted);opacity:0;font-weight:400}
article h2:hover .anchor,article h3:hover .anchor,.anchor:focus{opacity:1}
article a{color:var(--accent);text-underline-offset:2px}
article li{margin:4px 0}
article ul,article ol{padding-left:22px}
article code{background:var(--code);padding:1px 5px;border-radius:5px;font:.88em ui-monospace,SFMono-Regular,Menlo,monospace}
article pre{position:relative;background:var(--code);border-radius:12px;padding:14px 16px;overflow-x:auto;font-size:14px;line-height:1.5}
article pre code{background:none;padding:0;font-size:inherit}
article pre button{position:absolute;top:8px;right:8px;min-height:30px;opacity:.85}
article pre.mermaid{background:var(--card);border:1px solid var(--line);text-align:center;line-height:1.2}
article pre.mermaid svg{min-width:min(640px,100%)}
@media (max-width:639px){article pre.mermaid svg{min-width:640px}}
article blockquote{margin:16px 0;padding:2px 16px;border-left:4px solid var(--accent);color:var(--muted)}
.table{overflow-x:auto;margin:16px 0;border:1px solid var(--line);border-radius:12px;background:var(--card)}
table{border-collapse:collapse;width:100%;font-size:15px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}
th{background:var(--soft);white-space:nowrap}
.edit{margin-top:40px;font-size:14px}
@media (min-width:640px){main{padding-top:48px}h1{font-size:40px}article h1{font-size:36px}}
@media (min-width:900px){
  .docs{display:grid;grid-template-columns:15rem minmax(0,1fr);gap:40px;align-items:start}
  .menu{position:sticky;top:72px;max-height:calc(100vh - 88px);overflow-y:auto;background:none;border:0;margin:0}
  .menu summary{display:none}
}
`

const SCRIPT = `
document.querySelectorAll('article pre:not(.mermaid)').forEach((pre) => {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Copy'; b.dataset.copy = pre.textContent; pre.append(b)
})
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copy]'); if (!b) return
  try { await navigator.clipboard.writeText(b.dataset.copy.trim()); b.textContent = 'Copied'; setTimeout(() => (b.textContent = 'Copy'), 1500) } catch {}
})
const menu = document.querySelector('.menu'), wide = matchMedia('(min-width:900px)')
const tab = document.querySelector('.tabs [aria-current]'); if (tab) tab.parentNode.scrollLeft = tab.offsetLeft - 16
const fit = () => menu && (menu.open = wide.matches); fit(); wide.addEventListener?.('change', fit)
`

const MERMAID = `<script type="module">
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs'
mermaid.initialize({ startOnLoad: true, theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'neutral' })
</script>`

const layout = ({ title, description, section, body, mermaid = false }) => `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>${CSS}</style>
<header class="top"><div>
  <a class="brand" href="/"><img src="/favicon.svg" alt="">feedbai</a>
  <nav><a href="/"${section === 'start' ? ' aria-current="page"' : ''}>Start</a><a href="/docs"${section === 'docs' ? ' aria-current="page"' : ''}>Docs</a><a href="${REPO}">GitHub</a></nav>
</div></header>
${body}
<footer>
  <a href="${REPO}">Source code (GPL-3.0)</a>
  <a href="/docs/on-your-own">Use it without this site</a>
  <a href="/docs/privacy">Privacy</a>
  <a href="/docs/security">Security</a>
  <a href="${REPO}/issues">Report a problem</a>
</footer>
<script>${SCRIPT}</script>
${mermaid ? MERMAID : ''}
</html>`

const home = (env, way, all) => {
  const ready = Boolean(env.FEEDBAI_APP_ID && env.FEEDBAI_APP_PRIVATE_KEY && env.FEEDBAI_MATRIX_TOKEN)
  const bot = env.FEEDBAI_MATRIX_USER || '@feedbai:matrix.org'
  const first = way.path === '/'
  return layout({
    title: first ? 'feedbai: user feedback, straight to your issues' : `${way.title} · feedbai`,
    description: first ? 'People mention @feedbai in your chat; a GitHub issue appears. Free, open source, nothing to install.' : way.lead,
    section: 'start',
    body: `<main>
<p class="status"><span class="dot${ready ? '' : ' off'}"></span>${ready ? 'Hub running' : 'Hub not configured'}</p>
<h1>Your users' feedback, straight into your issues.</h1>
<p class="lead">People already talk about your project in chat. When they mention the bot, feedbai turns their message into a GitHub issue, so you (or your AI agents) can fix it.</p>
<ol class="flow">
  <li><span class="icon">💬</span><div>Someone writes in your chat room<br>${chat(`${bot} the play button doesn't work on Safari`)}</div></li>
  <li><span class="icon">📋</span><div>A GitHub issue appears<small>Labelled <b>feedback</b>, with a link back to the message.</small></div></li>
  <li><span class="icon">🛠️</span><div>You or your agent fix it<small>And reply in the chat when it's done.</small></div></li>
</ol>
<p class="label" id="ways">How do you want to use it?</p>
<nav class="tabs" aria-label="Ways to use feedbai">${all
      .map((w) => `<a href="${w.path === '/' ? '/#ways' : `${w.path}#ways`}"${w === way ? ' aria-current="page"' : ''}>${esc(w.tab)}${w.hint ? ` <small>${esc(w.hint)}</small>` : ''}</a>`)
      .join('')}</nav>
<section class="way">
<h2>${esc(way.title)}</h2>
<p>${esc(way.lead)}</p>
<ol class="steps">${way.steps.map((s) => `<li>${s}</li>`).join('')}</ol>
<a class="more" href="${way.more[0]}">${esc(way.more[1])} →</a>
</section>
<p class="label">Questions</p>
<details class="faq"><summary>Does it cost anything?</summary><div>No. feedbai is free and open source (GPL-3.0). This hub is run by internet4000; you can run your own, or do without one.</div></details>
<details class="faq"><summary>Which messages become issues?</summary><div>Only messages that mention the bot, and later replies in the same thread. Everything else stays in the chat. Messages from bots listed in your config never open issues.</div></details>
<details class="faq"><summary>Does it keep my users' messages?</summary><div>No. The hub stores nothing. The issues it opens quote the messages, in your repository. Details in the <a href="/docs/privacy">privacy notes</a>.</div></details>
<details class="faq"><summary>How do I stop it?</summary><div>Remove the bot from your room, or uninstall the GitHub App. Either one stops it immediately.</div></details>
<details class="faq"><summary>What about Bluesky and other places?</summary><div>Bluesky works too: threads become issues, and searches give you the general mood. GitHub Discussions can be read. More channels get added when a project asks: <a href="${REPO}/issues/10">tell us which</a>.</div></details>
<details class="faq"><summary>I'm a developer: is there an API?</summary><div>Yes, read-only and public: <code>/v1/matrix?room=#room:server</code> and <code>/v1/bluesky/search?query=…</code>. They return the same items as <code>feedbai fetch --format json</code>. <a href="/docs/hub">Details</a>.</div></details>
</main>`,
  })
}

const menu = (current) => {
  const groups = [...new Set(DOCS.map((d) => d.group))]
  return `<details class="menu"><summary>${esc(current.label ?? current.title)}</summary><nav aria-label="Documentation">${groups
    .map((g) => `<b>${esc(g)}</b>${DOCS.filter((d) => d.group === g).map((d) => `<a href="${d.route}"${d === current ? ' aria-current="page"' : ''}>${esc(d.label ?? d.title)}</a>`).join('')}`)
    .join('')}</nav></details>`
}

const docPage = (doc, docs) => {
  const { html, mermaid } = render(docs[doc.file], { link: (href) => resolveLink(doc.file, href) })
  return layout({
    title: `${doc.title} · feedbai docs`,
    description: `feedbai documentation: ${doc.title}`,
    section: 'docs',
    mermaid,
    body: `<main class="docs">${menu(doc)}<article>${html}<p class="edit"><a href="${REPO}/edit/main/${doc.file}">Edit this page on GitHub</a></p></article></main>`,
  })
}

/** Renders a site page: { status, html }, or null when the path isn't one (API routes, assets). */
export const site = ({ path, env = {}, docs }) => {
  for (const d of DOCS) d.title ??= render(docs[d.file] ?? '').title || d.file
  const all = ways(env)
  const way = all.find((w) => w.path === path)
  if (way) return { status: 200, html: home(env, way, all) }
  const doc = DOCS.find((d) => d.route === path.replace(/\/$/, '') || d.route === path.replace(/\.md$/, ''))
  if (doc && docs[doc.file] !== undefined) return { status: 200, html: docPage(doc, docs) }
  if (path.startsWith('/v1/') || path.startsWith('/.well-known/')) return null
  return {
    status: 404,
    html: layout({ title: 'Not found · feedbai', description: 'Page not found', section: '', body: `<main><h1>Not found</h1><p class="lead">No page at <code>${esc(path)}</code>.</p><a class="btn" href="/">Go to the start</a><a class="more" href="/docs">Browse the docs →</a></main>` }),
  }
}
