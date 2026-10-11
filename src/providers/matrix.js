import { request, query } from '../http.js'
import { getSecret } from '../secrets.js'
import { item, requireFields } from '../model.js'
import { t } from '../i18n.js'
import { hubUrl, readViaHub } from '../hub.js'

const DEFAULT_HOMESERVER = 'https://matrix.org'
const PAGE = 100

/** Accept "#room:server", "!id:server" or a matrix.to link. */
export const parseRoom = (room) => decodeURIComponent(room.replace(/^https:\/\/matrix\.to\/#\//, '').split('?')[0])

const api = (homeserver, path) => `${homeserver.replace(/\/$/, '')}/_matrix/client/v3${path}`

const token = (account) => getSecret(account?.secrets?.token)

const resolveRoomId = async (homeserver, room, fetchImpl) => {
  if (room.startsWith('!')) return room
  const data = await request(api(homeserver, `/directory/room/${encodeURIComponent(room)}`), { fetchImpl })
  return data.room_id
}

const toItem = ({ event, names, roomId, project, source }) => {
  const relates = event.content['m.relates_to'] ?? {}
  const edit = relates.rel_type === 'm.replace'
  const content = edit ? (event.content['m.new_content'] ?? event.content) : event.content
  return item({
    id: event.event_id,
    platform: 'matrix',
    project: project.id,
    source: source.id,
    author: { id: event.sender, ...(names[event.sender] && { name: names[event.sender] }) },
    text: relates['m.in_reply_to'] ? stripReplyFallback(content.body) : content.body,
    url: `https://matrix.to/#/${encodeURIComponent(roomId)}/${encodeURIComponent(event.event_id)}`,
    createdAt: new Date(event.origin_server_ts).toISOString(),
    replyTo: relates['m.in_reply_to']?.event_id,
    mentions: content['m.mentions']?.user_ids,
    edits: edit ? relates.event_id : undefined,
    thread: relates.rel_type === 'm.thread' ? relates.event_id : undefined,
  })
}

/** Replies start with a quoted copy of the parent ("> <@user> text") for old clients; replyTo already links it. */
const stripReplyFallback = (body) => body.replace(/^(> .*\n)+\n/, '')

/**
 * Rooms with history visibility "joined"/"invited" hide everything sent before the account
 * joined: /messages just ends early. Say so, or a short history looks like all there is.
 */
const hiddenHistory = async ({ homeserver, roomId, room, account, oldest, auth }) => {
  const url = api(homeserver, `/rooms/${encodeURIComponent(roomId)}/state/m.room.history_visibility`)
  const { history_visibility: visibility } = await request(url, auth).catch(() => ({}))
  if (visibility !== 'joined' && visibility !== 'invited') return []
  const missing = oldest ? t('notice.before', { date: new Date(oldest).toISOString() }) : t('notice.anything')
  return [t('notice.matrixHistoryHidden', { room, visibility, missing, account: account.user ?? account.id })]
}

/** Messages with a text body, edits included (they carry the new text); redactions have none. */
const isFeedback = (event) => event.type === 'm.room.message' && typeof event.content?.body === 'string'

export default {
  type: 'matrix',

  validate: (source) => requireFields(source, ['id', 'room'], t),

  needsAuth: () => true,

  authStatus: (account) => (account ? (token(account) ? 'ok' : 'missing') : hubUrl() ? 'hub' : 'none'),

  async fetch({ project, source, account, since, limit, fetchImpl }) {
    const accessToken = token(account)
    if (!accessToken) {
      if (!account && hubUrl()) {
        const params = { room: source.room, since: since?.toISOString(), limit }
        return readViaHub({ path: '/v1/matrix', params, platform: 'matrix', project, source, fetchImpl })
      }
      throw new Error(t('error.authRequired', { source: source.id, mode: 'room', type: 'matrix' }))
    }
    const homeserver = account.homeserver ?? DEFAULT_HOMESERVER
    const room = parseRoom(source.room)
    const roomId = await resolveRoomId(homeserver, room, fetchImpl)
    const auth = { token: accessToken, fetchImpl }

    if (source.join) await request(api(homeserver, `/join/${encodeURIComponent(roomId)}`), { ...auth, method: 'POST', body: {} })

    const filter = JSON.stringify({ types: ['m.room.message'], lazy_load_members: true })
    const items = []
    const names = {}
    let from
    let oldest // timestamp of the oldest event the account can see
    let exhausted = false // ran out of history before `since`/`limit`
    while (items.length < limit) {
      const url = api(homeserver, `/rooms/${encodeURIComponent(roomId)}/messages?`) +
        query({ dir: 'b', limit: Math.min(PAGE, limit), filter, from })
      let page
      try {
        page = await request(url, auth)
      } catch (error) {
        if (error.status === 403) throw Object.assign(new Error(t('error.matrixForbidden', { room })), { status: 403 })
        throw error
      }
      for (const member of page.state ?? []) {
        if (member.type === 'm.room.member' && member.content?.displayname) names[member.state_key] = member.content.displayname
      }
      let reachedSince = false
      for (const event of page.chunk ?? []) {
        if (since && event.origin_server_ts < since.getTime()) {
          reachedSince = true
          break
        }
        oldest = event.origin_server_ts
        if (isFeedback(event)) items.push(toItem({ event, names, roomId, project, source }))
        if (items.length >= limit) break
      }
      if (reachedSince || items.length >= limit) break
      if (!page.end || !page.chunk?.length) {
        exhausted = true
        break
      }
      from = page.end
    }
    const notices = exhausted ? await hiddenHistory({ homeserver, roomId, room, account, oldest, auth }) : []
    return { items: items.reverse(), notices }
  },

  /** The messages a reply points back to, oldest first (up to `depth`), as context for it. */
  async ancestors({ project, source, account, entry, depth = 3, fetchImpl }) {
    const accessToken = token(account)
    if (!accessToken) return []
    const homeserver = account.homeserver ?? DEFAULT_HOMESERVER
    const roomId = decodeURIComponent(entry.url.replace(/^https:\/\/matrix\.to\/#\//, '').split('/')[0])
    const chain = []
    let id = entry.replyTo
    while (id && chain.length < depth) {
      const url = api(homeserver, `/rooms/${encodeURIComponent(roomId)}/event/${encodeURIComponent(id)}`)
      const event = await request(url, { token: accessToken, fetchImpl }).catch(() => null)
      if (!event || !isFeedback(event)) break
      chain.unshift(toItem({ event, names: {}, roomId, project, source }))
      id = event.content['m.relates_to']?.['m.in_reply_to']?.event_id
    }
    return chain
  },

  /** Send `text` to `room`; with `replyTo` (event id) as a reply in that thread. Returns the new event's link. */
  async post({ account, room, text, replyTo, fetchImpl }) {
    const accessToken = token(account)
    if (!accessToken) throw new Error(t('error.authRequired', { source: account?.id ?? 'matrix', mode: 'post', type: 'matrix' }))
    const homeserver = account.homeserver ?? DEFAULT_HOMESERVER
    const roomId = await resolveRoomId(homeserver, parseRoom(room), fetchImpl)
    const txn = `feedbai-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const body = { msgtype: 'm.text', body: text, ...(replyTo && { 'm.relates_to': { 'm.in_reply_to': { event_id: replyTo } } }) }
    const url = api(homeserver, `/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txn}`)
    const data = await request(url, { method: 'PUT', token: accessToken, body, fetchImpl })
    return `https://matrix.to/#/${encodeURIComponent(roomId)}/${encodeURIComponent(data.event_id)}`
  },

  /** Exchange a password for an access token. */
  async login({ homeserver = DEFAULT_HOMESERVER, user, password, fetchImpl }) {
    const data = await request(api(homeserver, '/login'), {
      method: 'POST',
      fetchImpl,
      body: {
        type: 'm.login.password',
        identifier: { type: 'm.id.user', user },
        password,
        initial_device_display_name: 'feedbai',
      },
    })
    return { token: data.access_token, user: data.user_id }
  },

  /** Check a token and return the user id it belongs to. */
  async whoami({ homeserver = DEFAULT_HOMESERVER, token: accessToken, fetchImpl }) {
    const data = await request(api(homeserver, '/account/whoami'), { token: accessToken, fetchImpl })
    return data.user_id
  },
}
