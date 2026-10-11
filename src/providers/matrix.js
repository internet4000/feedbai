import { request, query } from '../http.js'
import { getSecret } from '../secrets.js'
import { item, requireFields } from '../model.js'
import { t } from '../i18n.js'

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
  return item({
    id: event.event_id,
    platform: 'matrix',
    project: project.id,
    source: source.id,
    author: { id: event.sender, ...(names[event.sender] && { name: names[event.sender] }) },
    text: event.content.body,
    url: `https://matrix.to/#/${encodeURIComponent(roomId)}/${encodeURIComponent(event.event_id)}`,
    createdAt: new Date(event.origin_server_ts).toISOString(),
    replyTo: relates['m.in_reply_to']?.event_id,
    mentions: event.content['m.mentions']?.user_ids,
    thread: relates.rel_type === 'm.thread' ? relates.event_id : undefined,
  })
}

/** Skip edits and redactions; keep messages with a text body. */
const isFeedback = (event) =>
  event.type === 'm.room.message' &&
  typeof event.content?.body === 'string' &&
  event.content['m.relates_to']?.rel_type !== 'm.replace'

export default {
  type: 'matrix',

  validate: (source) => requireFields(source, ['id', 'room'], t),

  needsAuth: () => true,

  authStatus: (account) => (!account ? 'none' : token(account) ? 'ok' : 'missing'),

  async fetch({ project, source, account, since, limit, fetchImpl }) {
    const accessToken = token(account)
    if (!accessToken) throw new Error(t('error.authRequired', { source: source.id, mode: 'room', type: 'matrix' }))
    const homeserver = account.homeserver ?? DEFAULT_HOMESERVER
    const room = parseRoom(source.room)
    const roomId = await resolveRoomId(homeserver, room, fetchImpl)
    const auth = { token: accessToken, fetchImpl }

    if (source.join) await request(api(homeserver, `/join/${encodeURIComponent(roomId)}`), { ...auth, method: 'POST', body: {} })

    const filter = JSON.stringify({ types: ['m.room.message'], lazy_load_members: true })
    const items = []
    const names = {}
    let from
    while (items.length < limit) {
      const url = api(homeserver, `/rooms/${encodeURIComponent(roomId)}/messages?`) +
        query({ dir: 'b', limit: Math.min(PAGE, limit), filter, from })
      let page
      try {
        page = await request(url, auth)
      } catch (error) {
        if (error.status === 403) throw new Error(t('error.matrixForbidden', { room }))
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
        if (isFeedback(event)) items.push(toItem({ event, names, roomId, project, source }))
        if (items.length >= limit) break
      }
      if (reachedSince || !page.end || !page.chunk?.length) break
      from = page.end
    }
    return items.reverse()
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
