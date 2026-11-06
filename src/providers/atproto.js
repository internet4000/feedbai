import { request, query } from '../http.js'
import { item, requireFields } from '../model.js'
import { t } from '../i18n.js'

/**
 * Feedback records on the AT Protocol: `com.internet4000.feedbai.feedback` records that people save in their
 * own account (Bluesky or any atproto host), naming a project. Found through Constellation, a public backlink
 * index (no account), then read from each author's own server, so a deleted record is gone here too.
 * Lexicon: lexicons/com/internet4000/feedbai/feedback.json.
 */
export const COLLECTION = 'com.internet4000.feedbai.feedback'
const CONSTELLATION = 'https://constellation.microcosm.blue'
const PLC = 'https://plc.directory'
const PAGE = 100

/** A project as records name it: "https://github.com/owner/name" (Constellation only indexes full URLs). */
export const projectUri = (value = '') => {
  const match = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(value.trim()) ?? /^([\w.-]+)\/([\w.-]+)$/.exec(value.trim())
  return match ? `https://github.com/${match[1]}/${match[2]}` : null
}

/** A DID's server (PDS) and handle, from its DID document (did:plc via plc.directory, did:web via its host). */
export const resolveDid = async (did, fetchImpl) => {
  const url = did.startsWith('did:plc:') ? `${PLC}/${did}` : did.startsWith('did:web:') ? `https://${did.slice(8).replaceAll(':', '/')}/.well-known/did.json` : null
  if (!url) return null
  const doc = await request(url, { fetchImpl })
  const pds = doc.service?.find((s) => s.id === '#atproto_pds' || s.id === `${did}#atproto_pds`)?.serviceEndpoint
  const handle = doc.alsoKnownAs?.find((a) => a.startsWith('at://'))?.slice(5)
  return pds ? { pds, handle } : null
}

/** References to every feedback record naming `target`, newest first, up to `max`. */
const backlinks = async (target, max, fetchImpl) => {
  const refs = []
  let cursor
  do {
    const page = await request(`${CONSTELLATION}/xrpc/blue.microcosm.links.getBacklinks?${query({ subject: target, source: `${COLLECTION}:project`, limit: PAGE, cursor })}`, { fetchImpl })
    refs.push(...(page.records ?? []))
    cursor = page.cursor
  } while (cursor && refs.length < max)
  return refs.slice(0, max)
}

export default {
  type: 'atproto',

  validate(source) {
    requireFields(source, ['id', 'project'], t)
    if (!projectUri(source.project)) throw new Error(t('error.missingField', { source: source.id, field: 'project (https://github.com/owner/name)' }))
  },

  describe: (source) => `feedback records for ${projectUri(source.project) ?? source.project}`,

  /** `feedbai add atproto <owner/name | github.com link>` */
  add: ([project]) => ({ project: projectUri(project ?? '') ?? project }),

  /** Public records, public index: no account. */
  needsAuth: () => false,
  authStatus: (account) => (account ? 'ok' : 'none'),

  /**
   * Records name the project they're for, so the project only files the ones naming its own repo:
   * a config listing someone else's project reads it, but never copies it into its own issues.
   */
  async mayFile({ source, repo }) {
    return projectUri(source.project)?.toLowerCase() === `https://github.com/${repo}`.toLowerCase()
  },

  async fetch({ project, source, since, limit, fetchImpl }) {
    const target = projectUri(source.project)
    const refs = await backlinks(target, limit * 2, fetchImpl)
    const dids = new Map()
    const did = (id) => dids.get(id) ?? dids.set(id, resolveDid(id, fetchImpl).catch(() => null)).get(id)
    const notices = []
    const items = await Promise.all(
      refs.map(async (ref) => {
        const author = await did(ref.did)
        if (!author) return null
        const uri = `at://${ref.did}/${ref.collection}/${ref.rkey}`
        try {
          const { value } = await request(`${author.pds.replace(/\/$/, '')}/xrpc/com.atproto.repo.getRecord?${query({ repo: ref.did, collection: ref.collection, rkey: ref.rkey })}`, { fetchImpl })
          // The index can lag behind an edit: trust the record itself
          if (projectUri(value?.project ?? '') !== target || typeof value.text !== 'string' || !value.text.trim()) return null
          const createdAt = new Date(value.createdAt)
          if (Number.isNaN(createdAt.getTime())) return null
          const page = typeof value.subject === 'string' && /^https?:\/\//.test(value.subject) ? `\n\nPage: ${value.subject}` : ''
          return item({
            id: uri,
            platform: 'atproto',
            project: project.id,
            source: source.id,
            author: { id: ref.did, ...(author.handle && { name: author.handle }) },
            text: `${value.text.trim()}${page}`,
            url: `https://pdsls.dev/${uri}`,
            createdAt: createdAt.toISOString(),
            // Anyone can write records naming any project: one thread (one issue) per day, so a flood costs one issue
            thread: `${source.id}:${createdAt.toISOString().slice(0, 10)}`,
          })
        } catch (error) {
          if (error.status === 400 || error.status === 404) return null // deleted by its author
          notices.push(`${uri}: ${error.message}`)
          return null
        }
      }),
    )
    const found = items
      .filter(Boolean)
      .filter((entry) => !since || new Date(entry.createdAt) >= since)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-limit)
    return notices.length ? { items: found, notices } : found
  },
}
