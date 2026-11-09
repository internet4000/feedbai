/**
 * Giving feedback to another project (#53): find where it listens, draft, and send from the person's own
 * accounts after they say yes. What a project declares (its `/.well-known/feedbai.json`, its repo's
 * feedbai.config.json) is untrusted: every field is checked here, links are limited to known kinds, and
 * the person always sees where it goes before anything is sent.
 */
import { request } from './http.js'
import { projectUri, parseRepo } from './links.js'

export const LABEL = '🤖 '
export const DAILY_CAP = 5 // per project, per person, per day: agents across many repos must not flood anyone
const MAX_TEXT = 4000

const ROOM = /^#[^\s:#]{1,100}:[a-z0-9.-]{1,100}$/i
const TAG = /^#[\p{L}\p{N}_]{1,64}$/u
const HANDLE = /^@?[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i
/** Channels feedbai can't send through, only link to: the person sends it from their own app. */
const CONTACT = [/^mailto:[^\s@]+@[^\s@]+$/i, /^tel:\+?[\d\s().-]{4,20}$/, /^https:\/\/signal\.me\/#[\w/+=.-]+$/, /^https:\/\/wa\.me\/\d{4,15}$/, /^https:\/\/bsky\.app\/chat\/[a-zA-Z0-9]{7,10}$/]

const str = (value, max = 200) => (typeof value === 'string' && value.length <= max ? value.trim() : '')

/**
 * The checked card of a project: where it listens. `raw` is a feedbai.json ({ project, matrix, bluesky,
 * contact }) or a project from a feedbai.config.json (sources). Anything malformed is dropped.
 */
export const contactCard = (raw = {}) => {
  const repository = projectUri(str(raw.project) || str(raw.repository))
  const sources = Array.isArray(raw.sources) ? raw.sources : []
  const matrix = [str(raw.matrix), ...sources.filter((s) => s?.type === 'matrix').map((s) => str(s.room))].find((r) => ROOM.test(r)) ?? null
  const bluesky = [str(raw.bluesky), ...sources.filter((s) => s?.type === 'bluesky' && s.mode === 'search').map((s) => str(s.query))].find((b) => TAG.test(b) || HANDLE.test(b)) ?? null
  const records = sources.some((s) => s?.type === 'atproto')
  const contact = (Array.isArray(raw.contact) ? raw.contact : []).map((c) => str(c, 300)).filter((c) => CONTACT.some((re) => re.test(c))).slice(0, 5)
  return { repository, matrix, bluesky: bluesky && TAG.test(bluesky) ? bluesky : bluesky ? `@${bluesky.replace(/^@/, '')}` : null, records, contact }
}

/** A site ("example.org", "https://example.org/page") or a repository ("owner/name", a GitHub link). */
export const targetKind = (target) => {
  if (parseRepo(target, { strict: true })) return { repo: projectUri(target) }
  try {
    const url = new URL(/^https?:\/\//.test(target) ? target : `https://${target}`)
    if (url.protocol === 'https:' && url.hostname.includes('.')) return { site: url.origin, page: `${url.origin}${url.pathname}` }
  } catch {}
  return null
}

const getJson = async (url, fetchImpl) => {
  try {
    return await request(url, { fetchImpl })
  } catch (error) {
    if (error.status === 404) return null
    throw error
  }
}

/** Where `target` listens: its site's feedbai.json, then its repository's feedbai.config.json. */
export const resolveTarget = async (target, { fetchImpl } = {}) => {
  const kind = targetKind(target)
  if (!kind) return null
  let declared = {}
  if (kind.site) declared = (await getJson(`${kind.site}/.well-known/feedbai.json`, fetchImpl)) ?? {}
  let card = contactCard(declared)
  const repository = kind.repo ?? card.repository
  if (repository) {
    const repo = repository.replace('https://github.com/', '')
    const config = await getJson(`https://raw.githubusercontent.com/${repo}/HEAD/feedbai.config.json`, fetchImpl)
    const project = (config?.projects ?? []).find((p) => projectUri(str(p?.repository))?.toLowerCase() === repository.toLowerCase())
    // The site's own declaration wins; the repo's config fills the gaps
    if (project) {
      const fromRepo = contactCard(project)
      card = { repository, matrix: card.matrix ?? fromRepo.matrix, bluesky: card.bluesky ?? fromRepo.bluesky, records: card.records || fromRepo.records, contact: card.contact.length ? card.contact : fromRepo.contact }
    } else card = { ...card, repository }
  }
  return { ...card, site: kind.site ?? null, page: kind.page ?? null }
}

/** The text as it goes out: marked as drafted by an agent, with the page it's about. */
export const compose = ({ text, page }) => `${LABEL}${text.trim()}${page ? `\n\n${page}` : ''}`.slice(0, MAX_TEXT)

const graphemes = (s) => [...new Intl.Segmenter().segment(s)].length

/** Each way to send it: `via` sends from the person's accounts; `link` opens it for them to send. */
export const ways = ({ card, text, title }) => {
  const list = []
  if (card.repository) {
    const issue = new URL(`${card.repository}/issues/new`)
    issue.searchParams.set('title', title)
    issue.searchParams.set('body', text)
    list.push({ via: 'issue', label: 'GitHub issue', link: issue.toString(), needs: 'a GitHub account' })
  }
  if (card.matrix) list.push({ via: 'matrix', label: `Matrix room ${card.matrix}`, link: `https://matrix.to/#/${encodeURIComponent(card.matrix)}`, needs: 'a Matrix account' })
  if (card.bluesky) {
    const post = `${text}\n\n${card.bluesky}`
    if (graphemes(post) <= 300) list.push({ via: 'bluesky', label: `Bluesky post with ${card.bluesky}`, link: `https://bsky.app/intent/compose?text=${encodeURIComponent(post)}`, needs: 'a Bluesky account' })
  }
  for (const link of card.contact) list.push({ via: null, label: contactLabel(link), link, needs: 'your own app' })
  return list
}

const contactLabel = (link) =>
  link.startsWith('mailto:') ? `Email ${link.slice(7)}` : link.startsWith('tel:') ? `Phone ${link.slice(4)}` : link.includes('signal.me') ? 'Signal' : link.includes('wa.me') ? 'WhatsApp' : 'Bluesky group chat'

/** Byte offsets for a Bluesky facet (they count UTF-8 bytes, not characters). */
const byteRange = (text, part) => {
  const start = Buffer.byteLength(text.slice(0, text.lastIndexOf(part)))
  return { byteStart: start, byteEnd: start + Buffer.byteLength(part) }
}

/** A Bluesky post from the person's own account, with the project's hashtag or mention as a real facet. */
export const postToBluesky = async ({ session, text, target, fetchImpl }) => {
  const body = `${text}\n\n${target}`
  const facets = []
  if (target.startsWith('#')) facets.push({ index: byteRange(body, target), features: [{ $type: 'app.bsky.richtext.facet#tag', tag: target.slice(1) }] })
  else {
    const { did } = await request(`${session.base}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(target.slice(1))}`, { fetchImpl })
    facets.push({ index: byteRange(body, target), features: [{ $type: 'app.bsky.richtext.facet#mention', did }] })
  }
  const record = { $type: 'app.bsky.feed.post', text: body, facets, createdAt: new Date().toISOString() }
  const { uri } = await request(`${session.base}/xrpc/com.atproto.repo.createRecord`, { method: 'POST', token: session.token, body: { repo: session.did, collection: 'app.bsky.feed.post', record }, fetchImpl })
  return `https://bsky.app/profile/${session.handle}/post/${uri.split('/').pop()}`
}

/** Today's count of sends to a project, and the state with this one added. */
export const countSend = (state, repository, now = new Date()) => {
  const day = now.toISOString().slice(0, 10)
  const sent = { ...(state.sent ?? {}) }
  const today = sent[repository]?.day === day ? sent[repository].count : 0
  sent[repository] = { day, count: today + 1 }
  return { today, state: { ...state, sent } }
}
