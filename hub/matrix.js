import { request } from '../src/http.js'
import { parseRoom } from '../src/providers/matrix.js'

const api = (homeserver, path) => `${homeserver.replace(/\/$/, '')}/_matrix/client/v3${path}`

/** Join every room the bot was invited to. Returns the joined room ids. */
export const acceptInvites = async ({ homeserver, token, fetchImpl }) => {
  const filter = JSON.stringify({ room: { timeline: { limit: 0 }, state: { lazy_load_members: true } }, presence: { types: [] } })
  const sync = await request(api(homeserver, `/sync?timeout=0&filter=${encodeURIComponent(filter)}`), { token, fetchImpl })
  const invited = Object.keys(sync.rooms?.invite ?? {})
  for (const roomId of invited) {
    await request(api(homeserver, `/join/${encodeURIComponent(roomId)}`), { method: 'POST', body: {}, token, fetchImpl })
  }
  return invited
}

/**
 * Anyone may read a public room through the hub's API: its messages are open to anyone who joins.
 * Throws (status 403) when the bot is not in the room, so callers can say "invite the bot".
 */
export const roomPublic = async ({ homeserver, token, room, fetchImpl }) => {
  const roomId = await resolve({ homeserver, room, fetchImpl })
  const rules = await request(api(homeserver, `/rooms/${encodeURIComponent(roomId)}/state/m.room.join_rules`), { token, fetchImpl })
  return rules.join_rule === 'public'
}

const resolve = async ({ homeserver, room, fetchImpl }) => {
  const alias = parseRoom(room)
  if (alias.startsWith('!')) return alias
  return (await request(api(homeserver, `/directory/room/${encodeURIComponent(alias)}`), { fetchImpl })).room_id
}

