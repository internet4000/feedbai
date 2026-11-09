import { request } from '../src/http.js'
import { parseRoom, topicNamesRepo } from '../src/providers/matrix.js'
import { notListedReason } from './allow.js'

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
export const declineReason = (room, rule) =>
  `feedbai hub: the shared bot only joins public rooms, so its shared token never sees private conversations; ${room} is "${rule || 'unknown'}". Fix: make the room public (Room settings → Security & Privacy → Public), then invite it again; or use your own bot: https://feedbai.internet4000.com/docs/on-your-own/`
const leaveReason = (room, rule) =>
  `feedbai hub: ${room} is no longer public ("${rule || 'unknown'}"); the shared bot only stays in public rooms. Make it public and invite it again, or use your own bot for private rooms: https://feedbai.internet4000.com/docs/on-your-own/`

const stripped = (invite, type) => invite?.invite_state?.events?.find((e) => e.type === type)?.content ?? {}
/** How to name the room to its admins: its alias when it has one. */
const roomName = (roomId, alias) => alias || roomId

/**
 * Join the public rooms the bot was invited to; decline the others, and leave joined rooms that are no
 * longer public. With `topicOk` (an invite-only hub, hub/allow.js), also only rooms whose topic it accepts.
 * `env` (with FEEDBAI_PROJECTS) words the invite-only reasons. Returns { joined, declined, left } room ids, and
 * `why`: one line per declined or left room, for the hub's log.
 */
export const acceptInvites = async ({ homeserver, token, fetchImpl, topicOk = null, env = {} }) => {
  const auth = { token, fetchImpl }
  const filter = JSON.stringify({ room: { timeline: { limit: 0 }, state: { lazy_load_members: true } }, presence: { types: [] } })
  const sync = await request(api(homeserver, `/sync?timeout=0&filter=${encodeURIComponent(filter)}`), auth)
  const joined = []
  const declined = []
  const why = []
  for (const [roomId, invite] of Object.entries(sync.rooms?.invite ?? {})) {
    const room = encodeURIComponent(roomId)
    const name = roomName(roomId, stripped(invite, 'm.room.canonical_alias').alias)
    const rule = stripped(invite, 'm.room.join_rules').join_rule
    const topic = stripped(invite, 'm.room.topic').topic ?? ''
    const isPublic = rule === 'public'
    const ok = isPublic && (!topicOk || topicOk(topic))
    const reason = ok ? null : isPublic ? notListedReason(env, { room: name, topic }) : declineReason(name, rule)
    await request(api(homeserver, ok ? `/join/${room}` : `/rooms/${room}/leave`), { method: 'POST', body: ok ? {} : { reason }, ...auth })
    ;(ok ? joined : declined).push(roomId)
    if (reason) why.push(`declined ${name === roomId ? name : `${name} (${roomId})`}: ${reason}`)
  }
  const left = []
  for (const roomId of Object.keys(sync.rooms?.join ?? {})) {
    const rule = (await state(homeserver, roomId, 'm.room.join_rules', auth)).join_rule
    const isPublic = rule === 'public'
    const topic = isPublic && topicOk ? ((await state(homeserver, roomId, 'm.room.topic', auth)).topic ?? '') : ''
    if (isPublic && (!topicOk || topicOk(topic))) continue
    const name = roomName(roomId, (await state(homeserver, roomId, 'm.room.canonical_alias', auth)).alias)
    const reason = isPublic ? notListedReason(env, { room: name, topic }) : leaveReason(name, rule)
    await request(api(homeserver, `/rooms/${encodeURIComponent(roomId)}/leave`), { method: 'POST', body: { reason }, ...auth })
    left.push(roomId)
    why.push(`left ${name === roomId ? name : `${name} (${roomId})`}: ${reason}`)
  }
  return { joined, declined, left, why }
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

/**
 * Has this room's admins tied it to `repo`? Its topic names the repository (github.com/owner/name): the same
 * consent rule as private rooms. A repository proving who it is (hub/identity.js) is not enough on its own:
 * anyone can list any room in their config.
 */
/** The room's topic (resolving an alias first). */
export const roomTopic = async ({ homeserver, token, room, fetchImpl }) => {
  const roomId = await resolve({ homeserver, room, fetchImpl })
  return (await state(homeserver, roomId, 'm.room.topic', { token, fetchImpl })).topic ?? ''
}

export const roomBoundTo = async ({ homeserver, token, room, repo, fetchImpl }) => {
  const roomId = await resolve({ homeserver, room, fetchImpl })
  const { topic = '' } = await state(homeserver, roomId, 'm.room.topic', { token, fetchImpl })
  return { roomId, bound: topicNamesRepo(topic, repo) }
}
