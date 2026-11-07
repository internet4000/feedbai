import { request } from '../src/http.js'
import { parseRoom } from '../src/providers/matrix.js'

/**
 * The hub's Matrix bot is shared by every project, so its token must be worth little if it leaks:
 * it sits only in public rooms (it declines invites to others, and leaves rooms that stop being public),
 * and the read API serves only rooms whose admins made them readable without joining (world_readable).
 * Private rooms: use your own bot (docs/on-your-own.md), whose token never reaches us.
 */
const api = (homeserver, path) => `${homeserver.replace(/\/$/, '')}/_matrix/client/v3${path}`

const state = (homeserver, roomId, type, auth) =>
  request(api(homeserver, `/rooms/${encodeURIComponent(roomId)}/state/${type}`), auth).catch((error) => {
    if (error.status === 404) return {} // no such state event: the spec's default applies
    throw error
  })

/** From the invite's stripped state (no need to join to read it). */
/** Shown by Matrix clients in the room ("feedbai rejected the invite: …"), so a decline is never silent. */
export const DECLINE_REASON =
  'The shared feedbai bot only joins public rooms, so its shared token never sees private conversations. Make the room public (Room settings → Security & Privacy → Public), then invite it again; or use your own bot: https://feedbai.internet4000.com/docs/on-your-own/'
const LEAVE_REASON = 'This room is no longer public; the shared feedbai bot only stays in public rooms. Use your own bot for private rooms: https://feedbai.internet4000.com/docs/on-your-own/'

const invitedPublic = (invite) => invite?.invite_state?.events?.find((e) => e.type === 'm.room.join_rules')?.content?.join_rule === 'public'

/**
 * Join the public rooms the bot was invited to; decline the others, and leave joined rooms that are no
 * longer public. Returns { joined, declined, left } room ids.
 */
export const acceptInvites = async ({ homeserver, token, fetchImpl }) => {
  const auth = { token, fetchImpl }
  const filter = JSON.stringify({ room: { timeline: { limit: 0 }, state: { lazy_load_members: true } }, presence: { types: [] } })
  const sync = await request(api(homeserver, `/sync?timeout=0&filter=${encodeURIComponent(filter)}`), auth)
  const joined = []
  const declined = []
  for (const [roomId, invite] of Object.entries(sync.rooms?.invite ?? {})) {
    const room = encodeURIComponent(roomId)
    const isPublic = invitedPublic(invite)
    await request(api(homeserver, isPublic ? `/join/${room}` : `/rooms/${room}/leave`), { method: 'POST', body: isPublic ? {} : { reason: DECLINE_REASON }, ...auth })
    ;(isPublic ? joined : declined).push(roomId)
  }
  const left = []
  for (const roomId of Object.keys(sync.rooms?.join ?? {})) {
    if ((await state(homeserver, roomId, 'm.room.join_rules', auth)).join_rule === 'public') continue
    await request(api(homeserver, `/rooms/${encodeURIComponent(roomId)}/leave`), { method: 'POST', body: { reason: LEAVE_REASON }, ...auth })
    left.push(roomId)
  }
  return { joined, declined, left }
}

/**
 * May anyone read this room through the hub, without joining? Only if its admins said so: history visibility
 * "world_readable" ("Anyone" in Element). A public room whose history is for members ("shared", the default)
 * must be read by joining it, visibly, with your own account.
 * Throws (status 403) when the bot is not in the room, so callers can say "invite the bot".
 */
export const roomWorldReadable = async ({ homeserver, token, room, fetchImpl }) => {
  const roomId = await resolve({ homeserver, room, fetchImpl })
  const visibility = await request(api(homeserver, `/rooms/${encodeURIComponent(roomId)}/state/m.room.history_visibility`), { token, fetchImpl })
  return visibility.history_visibility === 'world_readable'
}

const resolve = async ({ homeserver, room, fetchImpl }) => {
  const alias = parseRoom(room)
  if (alias.startsWith('!')) return alias
  return (await request(api(homeserver, `/directory/room/${encodeURIComponent(alias)}`), { fetchImpl })).room_id
}
