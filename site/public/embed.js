/**
 * The feedbai button: a feedback button for any website. No login, no cookies, nothing stored by us.
 * The person writes their feedback, then picks a public place to send it, opened prefilled for them to
 * review and send: a Bluesky post, a GitHub issue, the project's Matrix room, or a feedback record saved in their
 * own Bluesky account (signing in on auth.feedbai.internet4000.com). feedbai already listens to all four.
 *
 *   <script type="module" src="https://feedbai.internet4000.com/embed.js"
 *     data-project="https://github.com/owner/repo" data-matrix="#room:server" data-bluesky="#yourproject"></script>
 *
 * Or place <feedbai-button project="…"></feedbai-button> where the button should be (load the script once).
 * Attributes: project (GitHub repo), matrix (room alias), bluesky (a hashtag or @handle added to posts so the
 * project's Bluesky source finds them), bot (the Matrix bot to mention, default @feedbai:matrix.org),
 * label (button text), inline (show the form itself, no button). Docs: https://feedbai.internet4000.com/docs/button/
 */
export const VERSION = '0.1.0'
const DEFAULT_BOT = '@feedbai:matrix.org'
const BLUESKY_LIMIT = 300 // graphemes in a Bluesky post
const AUTH = 'https://auth.feedbai.internet4000.com' // sign-in page, on its own origin

/** The page being talked about: origin + path only. Query strings and fragments can hold tokens or personal data. */
export const pageAddress = (href) => {
  try {
    const url = new URL(href)
    return /^https?:$/.test(url.protocol) ? `${url.origin}${url.pathname}` : ''
  } catch {
    return ''
  }
}

/** "owner/repo" from "https://github.com/owner/repo", "github.com/owner/repo" or "owner/repo"; null otherwise. */
export const repoOf = (project = '') => {
  const match = String(project).trim().match(/^(?:(?:https?:\/\/)?github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i)
  return match ? `${match[1]}/${match[2]}` : null
}

const graphemes = (text) => (typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter().segment(text)].map((s) => s.segment) : [...text])
const cut = (text, max) => {
  const parts = graphemes(text)
  return parts.length <= max ? text : `${parts.slice(0, max - 1).join('').trimEnd()}…`
}

/** Where the feedback can go, each a prefilled link: [{ id, label, href, copy? }]. Pure, so it's tested in Node. */
export const routes = ({ text, page = '', project, matrix, bluesky, bot = DEFAULT_BOT }) => {
  const body = String(text ?? '').trim()
  const out = []
  const tag = bluesky ? ` ${bluesky.trim()}` : ''
  const tail = `${tag}${page ? `\n${page}` : ''}`
  out.push({
    id: 'bluesky',
    label: 'Post on Bluesky',
    href: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${cut(body, BLUESKY_LIMIT - graphemes(tail).length)}${tail}`)}`,
  })
  const repo = repoOf(project)
  if (repo) {
    const title = cut(body.replace(/\s+/g, ' '), 72) || 'Feedback'
    const issue = `${cut(body, 4000)}${page ? `\n\nPage: ${page}` : ''}\n\n<sub>Sent with the [feedbai button](https://feedbai.internet4000.com/docs/button/)</sub>`
    out.push({ id: 'github', label: 'Open a GitHub issue', href: `https://github.com/${repo}/issues/new?${new URLSearchParams({ title, body: issue, labels: 'feedback' })}` })
  }
  if (repo) {
    const connect = new URLSearchParams({ project: `https://github.com/${repo}`, text: cut(body, 3000), ...(page && { subject: page }) })
    out.push({ id: 'account', label: 'Save to my Bluesky account', href: `${AUTH}/connect/?${connect}` })
  }
  if (matrix) {
    out.push({
      id: 'matrix',
      label: 'Say it in the chat room',
      href: `https://matrix.to/#/${encodeURIComponent(matrix.trim())}`,
      copy: `${bot} ${body}${page ? `\n${page}` : ''}`,
    })
  }
  return out
}

const CSS = `
:host{--accent:#1f9d5c;--accent-ink:#fff;--bg:#fff;--ink:#10201a;--muted:#5b6b63;--line:#dfe7e2;--soft:#eef2ef;all:initial;font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink)}
@media (prefers-color-scheme:dark){:host{--accent:#3ddc84;--accent-ink:#0b2a1a;--bg:#13201a;--ink:#e8f1ec;--muted:#9bb0a5;--line:#2a3d33;--soft:#1b2b23}}
*{box-sizing:border-box}
.trigger{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:999px;border:0;background:var(--accent);color:var(--accent-ink);font:600 15px/1 inherit;font-family:inherit;cursor:pointer;box-shadow:0 4px 16px rgb(0 0 0/.18)}
.trigger:focus-visible,button:focus-visible,a:focus-visible,textarea:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
:host([floating]) .trigger{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:2147483646}
.trigger .ico{font-size:17px;line-height:1}
@media (max-width:480px){:host([floating]) .trigger{width:52px;height:52px;padding:0;justify-content:center}:host([floating]) .trigger .lbl{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}}
.panel{background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:16px;padding:16px;width:min(380px,calc(100vw - 32px));box-shadow:0 12px 40px rgb(0 0 0/.22)}
.panel[hidden]{display:none}
:host(:not([inline])) .panel{position:fixed;right:16px;bottom:72px;z-index:2147483647;max-height:calc(100vh - 96px);overflow:auto}
:host([inline]) .panel{width:100%;box-shadow:none}
:host([inline]) header{display:none}
@media (max-width:480px){:host(:not([inline])) .panel{left:0;right:0;bottom:0;width:100%;border-radius:16px 16px 0 0;max-height:85vh}}
header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
h2{font:700 17px/1.3 inherit;font-family:inherit;margin:0}
.close{border:0;background:none;color:var(--muted);font-size:24px;line-height:1;width:40px;height:40px;cursor:pointer;border-radius:8px}
label{display:block;font-weight:600;font-size:14px;margin-bottom:6px}
textarea{display:block;width:100%;min-height:110px;resize:vertical;border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:var(--soft);color:var(--ink);font:inherit}
.page{display:flex;align-items:center;gap:6px;margin:8px 0 0;font-size:13px;color:var(--muted);min-width:0}
.page span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.page button{border:0;background:none;color:var(--muted);text-decoration:underline;font:inherit;cursor:pointer;padding:4px}
.to{font-weight:600;font-size:14px;margin:14px 0 8px}
.routes{display:grid;gap:8px}
.routes a{display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:12px;border:1px solid var(--line);background:var(--soft);color:var(--ink);text-decoration:none;font-weight:600;font-size:15px}
.routes a.first{background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
.routes[aria-disabled="true"] a{opacity:.45;pointer-events:none}
.note{font-size:12.5px;color:var(--muted);margin:10px 0 0}
.note a{color:inherit}
.done{font-size:14px;margin:8px 0 0;color:var(--ink)}
`

const BaseElement = typeof HTMLElement === 'undefined' ? class {} : HTMLElement

export class FeedbaiButton extends BaseElement {
  connectedCallback() {
    if (this.shadowRoot) return
    const root = this.attachShadow({ mode: 'open' })
    const inline = this.hasAttribute('inline')
    const id = `fb-${Math.random().toString(36).slice(2, 8)}`
    root.innerHTML = `<style>${CSS}</style>
${inline ? '' : `<button class="trigger" type="button" aria-expanded="false" aria-controls="${id}"></button>`}
<section class="panel" id="${id}" role="${inline ? 'region' : 'dialog'}" aria-labelledby="${id}-t" ${inline ? '' : 'hidden'}>
  <header><h2 id="${id}-t">Send feedback</h2>${inline ? '' : '<button class="close" type="button" aria-label="Close">×</button>'}</header>
  <label for="${id}-x">What works, what doesn't?</label>
  <textarea id="${id}-x" maxlength="4000" placeholder="The play button does nothing on Safari…"></textarea>
  <p class="page"></p>
  <p class="to">Send it, publicly, with:</p>
  <div class="routes" aria-disabled="true"></div>
  <p class="done" role="status" aria-live="polite"></p>
  <p class="note">Opens there prefilled: you review it and send it from your account. These places are public. <a href="https://feedbai.internet4000.com/docs/button/" target="_blank" rel="noopener">About feedbai</a></p>
</section>`
    const $ = (s) => root.querySelector(s)
    const panel = $('.panel')
    const trigger = $('.trigger')
    const textarea = $('textarea')
    const routesEl = $('.routes')
    const pageEl = $('.page')
    const done = $('.done')
    let page = this.getAttribute('page') ?? pageAddress(location.href)

    const renderPage = () => {
      pageEl.innerHTML = page ? '<span></span><button type="button">don\'t include</button>' : ''
      if (page) {
        pageEl.querySelector('span').textContent = `About: ${page}`
        pageEl.querySelector('button').onclick = () => { page = ''; renderPage(); render() }
      }
    }
    const render = () => {
      const text = textarea.value
      routesEl.setAttribute('aria-disabled', String(!text.trim()))
      routesEl.replaceChildren(
        ...routes({ text, page, project: this.getAttribute('project'), matrix: this.getAttribute('matrix'), bluesky: this.getAttribute('bluesky'), bot: this.getAttribute('bot') || undefined }).map((r, i) => {
          const a = document.createElement('a')
          a.href = r.href
          a.target = '_blank'
          a.rel = 'noopener noreferrer'
          a.textContent = r.label
          if (i === 0) a.className = 'first'
          a.onclick = async (e) => {
            if (!textarea.value.trim()) return e.preventDefault()
            if (r.copy) {
              try { await navigator.clipboard.writeText(r.copy); done.textContent = 'Copied: paste it in the room that opens.' } catch { done.textContent = `Copy this into the room: ${r.copy}` }
            } else done.textContent = 'Opened in a new tab: send it there. Thank you!'
          }
          return a
        }),
      )
    }
    const open = (show) => {
      if (inline) return
      panel.hidden = !show
      trigger.setAttribute('aria-expanded', String(show))
      if (show) textarea.focus()
      else trigger.focus()
    }
    if (trigger) {
      const ico = document.createElement('span')
      ico.className = 'ico'
      ico.setAttribute('aria-hidden', 'true')
      ico.textContent = '💬'
      const lbl = document.createElement('span')
      lbl.className = 'lbl'
      lbl.textContent = this.getAttribute('label') || 'Feedback'
      trigger.replaceChildren(ico, lbl)
      trigger.onclick = () => open(panel.hidden)
      $('.close').onclick = () => open(false)
      root.addEventListener('keydown', (e) => e.key === 'Escape' && !panel.hidden && open(false))
    }
    textarea.addEventListener('input', render)
    renderPage()
    render()
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('feedbai-button')) {
  customElements.define('feedbai-button', FeedbaiButton)
  // Loaded with data-project: add a floating button. Placed <feedbai-button> elements need nothing more.
  const script = [...document.querySelectorAll('script[src]')].find((s) => s.src === import.meta.url && s.dataset.project !== undefined)
  if (script) {
    const el = document.createElement('feedbai-button')
    for (const [key, value] of Object.entries(script.dataset)) el.setAttribute(key, value)
    el.setAttribute('floating', '')
    document.body.append(el)
  }
}
