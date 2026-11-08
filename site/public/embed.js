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
 * label (button text), inline (show the form itself, no button), records (also offer "keep it in my Bluesky
 * account", experimental). Docs: https://feedbai.internet4000.com/docs/button/
 */
export const VERSION = '0.2.0'
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

/** "owner/repo" for a GitHub repository (not a link to something in it); null otherwise. Same rules as src/links.js. */
export const repoOf = (project = '') => {
  const text = String(project).trim()
  const match = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w-]+)\/([\w.-]+?)(?:\.git)?(\/.*|[?#].*)?$/i.exec(text)
  if (match) return match[3] && match[3] !== '/' ? null : `${match[1]}/${match[2]}`
  const short = /^([\w-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(text)
  return short ? `${short[1]}/${short[2]}` : null
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

/** What each place is, for someone deciding where to send it: plain words, and what it needs. */
const PLACES = {
  matrix: { icon: '💬', title: 'Talk to the team', hint: 'In their chat room · a Matrix account' },
  bluesky: { icon: '🦋', title: 'Post on Bluesky', hint: 'A public post · a Bluesky account' },
  github: { icon: '🐙', title: 'Open an issue', hint: 'For developers · a GitHub account' },
  account: { icon: '🔒', title: 'Keep it in my Bluesky account', hint: 'A record only the project reads · a Bluesky account' },
}
const ORDER = ['matrix', 'bluesky', 'github', 'account']
const LAST = 'feedbai-last-place'
const remember = (id) => { try { localStorage.setItem(LAST, id) } catch {} }
const last = () => { try { return localStorage.getItem(LAST) } catch { return null } }

const CSS = `
:host{--accent:#1f9d5c;--accent-ink:#fff;--bg:#fff;--ink:#10201a;--muted:#5b6b63;--line:#dfe7e2;--soft:#f1f5f2;all:initial;font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink)}
@media (prefers-color-scheme:dark){:host{--accent:#3ddc84;--accent-ink:#0b2a1a;--bg:#15211b;--ink:#e8f1ec;--muted:#9bb0a5;--line:#2a3d33;--soft:#1d2c24}}
*{box-sizing:border-box}
button,a,textarea{font:inherit}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.trigger{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:999px;border:0;background:var(--accent);color:var(--accent-ink);font-weight:600;font-size:15px;cursor:pointer;box-shadow:0 4px 16px rgb(0 0 0/.18)}
.trigger .ico{font-size:17px;line-height:1}
:host([floating]) .trigger{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:2147483646}
@media (max-width:480px){:host([floating]) .trigger{width:52px;height:52px;padding:0;justify-content:center}:host([floating]) .trigger .lbl{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}}
dialog{border:0;padding:0;background:transparent;max-width:none;max-height:none;color:inherit}
dialog::backdrop{background:rgb(0 0 0/.35)}
.card{background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:18px;padding:20px;width:min(420px,calc(100vw - 32px));box-shadow:0 16px 48px rgb(0 0 0/.25)}
dialog[open]{position:fixed;inset:auto 16px 16px auto;margin:0}
@media (max-width:480px){dialog[open]{inset:auto 0 0 0}.card{width:100vw;border-radius:18px 18px 0 0;max-height:90vh;overflow:auto;padding-bottom:max(20px,env(safe-area-inset-bottom))}}
:host([inline]) .card{width:100%;box-shadow:none}
header{display:flex;align-items:center;gap:8px;margin-bottom:12px}
h2{font-size:18px;line-height:1.3;margin:0;flex:1}
.icon-btn{border:0;background:none;color:var(--muted);font-size:22px;line-height:1;width:40px;height:40px;border-radius:10px;cursor:pointer}
.icon-btn:hover{background:var(--soft)}
textarea{display:block;width:100%;min-height:120px;resize:vertical;border:1px solid var(--line);border-radius:12px;padding:12px;background:var(--soft);color:var(--ink)}
.chip{display:inline-flex;align-items:center;gap:6px;max-width:100%;margin-top:10px;padding:4px 6px 4px 10px;border-radius:999px;background:var(--soft);color:var(--muted);font-size:13px}
.chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chip button{border:0;background:none;color:inherit;cursor:pointer;font-size:16px;line-height:1;padding:2px 4px;border-radius:999px}
.primary{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin-top:16px;border:0;border-radius:12px;background:var(--accent);color:var(--accent-ink);font-weight:600;cursor:pointer;text-decoration:none}
.primary[aria-disabled=true]{opacity:.5;cursor:not-allowed}
.hint{min-height:1.2em;margin:8px 0 0;font-size:13px;color:var(--muted)}
.places{display:grid;gap:8px;margin:0;padding:0;list-style:none}
.place{display:flex;align-items:center;gap:12px;width:100%;min-height:60px;padding:10px 14px;border:1px solid var(--line);border-radius:14px;background:var(--bg);color:var(--ink);text-decoration:none;text-align:left}
.place:hover{border-color:var(--accent);background:var(--soft)}
.place .i{font-size:22px;line-height:1;flex:none}
.place b{display:block;font-size:15px}
.place small{display:block;color:var(--muted);font-size:13px;margin-top:1px}
.place.last b::after{content:"  ·  last time";font-weight:400;color:var(--muted);font-size:12px}
.link{display:inline-block;margin-top:14px;border:0;background:none;padding:4px 0;color:var(--muted);text-decoration:underline;cursor:pointer;font-size:14px}
.note{font-size:13px;color:var(--muted);margin:14px 0 0}
.note a{color:inherit}
.done{text-align:center;padding:8px 0}
.done .big{font-size:40px;line-height:1;margin:4px 0 10px}
.done p{margin:0 0 6px}
`

const BaseElement = typeof HTMLElement === 'undefined' ? class {} : HTMLElement
const h = (html) => {
  const t = document.createElement('template')
  t.innerHTML = html
  return t.content
}

/**
 * The button, then a dialog in three short steps: what's on your mind → how to send it (each place says what it
 * needs, the one used last time first; "no account?" helps) → done, you'll hear back there.
 * Native <dialog>: focus stays inside, Escape closes, screen readers know it's a dialog. Bottom sheet on phones.
 */
export class FeedbaiButton extends BaseElement {
  connectedCallback() {
    if (this.shadowRoot) return
    this.root = this.attachShadow({ mode: 'open' })
    this.inline = this.hasAttribute('inline')
    this.text = ''
    this.page = this.getAttribute('page') ?? pageAddress(location.href)
    this.root.append(h(`<style>${CSS}</style>`))
    if (this.inline) {
      this.card = document.createElement('div')
      this.card.className = 'card'
      this.root.append(this.card)
      this.step('write')
      return
    }
    const trigger = document.createElement('button')
    trigger.className = 'trigger'
    trigger.type = 'button'
    trigger.setAttribute('aria-haspopup', 'dialog')
    trigger.append(h('<span class="ico" aria-hidden="true">💬</span><span class="lbl"></span>'))
    trigger.querySelector('.lbl').textContent = this.getAttribute('label') || 'Feedback'
    this.dialog = document.createElement('dialog')
    this.dialog.setAttribute('aria-labelledby', 'fb-title')
    this.card = document.createElement('div')
    this.card.className = 'card'
    this.dialog.append(this.card)
    this.dialog.addEventListener('click', (e) => e.target === this.dialog && this.dialog.close())
    this.dialog.addEventListener('close', () => trigger.focus())
    trigger.onclick = () => {
      this.step('write')
      this.dialog.showModal()
    }
    this.root.append(trigger, this.dialog)
  }

  places() {
    const list = routes({ text: this.text, page: this.page, project: this.getAttribute('project'), matrix: this.getAttribute('matrix'), bluesky: this.getAttribute('bluesky'), bot: this.getAttribute('bot') || undefined })
      .filter((r) => r.id !== 'account' || this.hasAttribute('records'))
      .sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id))
    const previous = last()
    return previous ? [...list.filter((r) => r.id === previous), ...list.filter((r) => r.id !== previous)] : list
  }

  header(title, back) {
    return `<header>${back ? '<button type="button" class="icon-btn back" aria-label="Back">‹</button>' : ''}<h2 id="fb-title">${title}</h2>${this.inline ? '' : '<button type="button" class="icon-btn close" aria-label="Close">×</button>'}</header>`
  }

  step(name, data) {
    const card = this.card
    card.replaceChildren()
    if (name === 'write') {
      card.append(h(`${this.header("What's on your mind?")}
        <label for="fb-text" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Your feedback</label>
        <textarea id="fb-text" maxlength="4000" placeholder="What works, what doesn't, what you'd like…"></textarea>
        <div class="page"></div>
        <button type="button" class="primary next" aria-disabled="true">Next</button>
        <p class="hint" role="status" aria-live="polite"></p>`))
      const textarea = card.querySelector('textarea')
      const next = card.querySelector('.next')
      textarea.value = this.text
      const update = () => next.setAttribute('aria-disabled', String(!textarea.value.trim()))
      textarea.oninput = () => {
        this.text = textarea.value
        card.querySelector('.hint').textContent = ''
        update()
      }
      update()
      const page = card.querySelector('.page')
      if (this.page) {
        page.append(h('<span class="chip"><span></span><button type="button" aria-label="Don\'t include the page address">×</button></span>'))
        page.querySelector('span span').textContent = `About ${this.page.replace(/^https?:\/\//, '')}`
        page.querySelector('button').onclick = () => {
          this.page = ''
          page.replaceChildren()
        }
      }
      next.onclick = () => (textarea.value.trim() ? this.step('choose') : (card.querySelector('.hint').textContent = 'Write something first.'))
      setTimeout(() => textarea.focus())
    } else if (name === 'choose') {
      card.append(h(`${this.header('How do you want to send it?', true)}<ul class="places"></ul>
        <button type="button" class="link none">I don't have any of these accounts</button>
        <p class="note">It opens there, written for you: you check it and send it yourself. These places are public.</p>`))
      const previous = last()
      for (const r of this.places()) {
        const place = PLACES[r.id]
        const li = document.createElement('li')
        const a = document.createElement('a')
        a.className = `place${r.id === previous ? ' last' : ''}`
        a.href = r.href
        a.target = '_blank'
        a.rel = 'noopener noreferrer'
        a.append(h('<span class="i" aria-hidden="true"></span><span><b></b><small></small></span>'))
        a.querySelector('.i').textContent = place.icon
        a.querySelector('b').textContent = place.title
        a.querySelector('small').textContent = place.hint
        a.onclick = async () => {
          remember(r.id)
          let copied = false
          if (r.copy) copied = await navigator.clipboard?.writeText(r.copy).then(() => true, () => false)
          this.step('done', { place: r, copied })
        }
        li.append(a)
        card.querySelector('.places').append(li)
      }
      card.querySelector('.back').onclick = () => this.step('write')
      card.querySelector('.none').onclick = () => this.step('none')
      setTimeout(() => card.querySelector('.place')?.focus())
    } else if (name === 'none') {
      card.append(h(`${this.header('No account? Easy.', true)}
        <p>The quickest: a free <b>Bluesky</b> account, about two minutes. Then come back and choose "Post on Bluesky".</p>
        <a class="primary" href="https://bsky.app/" target="_blank" rel="noopener noreferrer">Create a Bluesky account</a>
        <p class="note">Your feedback stays here while you do it.</p>`))
      card.querySelector('.back').onclick = () => this.step('choose')
    } else if (name === 'done') {
      const { place, copied } = data
      const where = PLACES[place.id].title.toLowerCase()
      const text = place.copy
        ? copied
          ? "It's copied: paste it in the room that just opened, and send."
          : 'Copy this into the room that just opened, and send:'
        : `Finish in the tab that just opened (${where}): check it, and send.`
      card.append(h(`${this.header('Almost done')}<div class="done"><div class="big" aria-hidden="true">🙌</div><p class="what"></p><p class="note">You'll get a reply there when it's done. Thank you!</p></div><button type="button" class="primary finish">Close</button>`))
      card.querySelector('.what').textContent = text
      if (place.copy && !copied) {
        const pre = document.createElement('textarea')
        pre.readOnly = true
        pre.value = place.copy
        card.querySelector('.done').append(pre)
      }
      card.querySelector('.finish').onclick = () => {
        this.text = ''
        if (this.inline) this.step('write')
        else this.dialog.close()
      }
      if (this.inline) card.querySelector('.finish').textContent = 'Send another'
    }
    card.querySelector('.close')?.addEventListener('click', () => this.dialog.close())
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
