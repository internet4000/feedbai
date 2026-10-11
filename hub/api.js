/**
 * The hub's read API: feedback from public Matrix rooms the bot was invited to, for anyone
 * running feedbai without a Matrix account (the CLI falls back to it). Same items as `feedbai fetch`.
 * GET /v1/matrix?room=#room:server[&since=ISO][&limit=n]
 */
import matrix from '../src/providers/matrix.js'
import { roomPublic } from './matrix.js'

const MAX_LIMIT = 100
const CACHE_SECONDS = 60

const json = (status, data) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': `public, max-age=${CACHE_SECONDS}` },
  })

export const readMatrix = async ({ params, env, fetchImpl }) => {
  const room = params.get('room')
  if (!room) return json(400, { error: 'missing ?room=#room:server' })
  const since = params.get('since') ? new Date(params.get('since')) : null
  if (since && Number.isNaN(since.getTime())) return json(400, { error: 'since must be an ISO date' })
  const limit = Math.min(Number(params.get('limit')) || 50, MAX_LIMIT)

  const homeserver = env.FEEDBAI_MATRIX_HOMESERVER ?? 'https://matrix.org'
  const bot = env.FEEDBAI_MATRIX_USER
  const invite = `invite ${bot} to ${room}, or read it with your own account (feedbai login matrix)`
  try {
    if (!(await roomPublic({ homeserver, token: env.FEEDBAI_MATRIX_TOKEN, room, fetchImpl }))) {
      return json(403, { error: `${room} is not public; the hub only serves public rooms` })
    }
    const account = { id: 'hub', type: 'matrix', homeserver, user: bot, secrets: { token: 'FEEDBAI_MATRIX_TOKEN' } }
    const source = { id: 'matrix', type: 'matrix', room }
    const items = await matrix.fetch({ project: { id: 'hub' }, source, account, since, limit, fetchImpl })
    return json(200, { room, items })
  } catch (error) {
    if (error.status === 403) return json(403, { error: `the hub's bot is not in ${room}: ${invite}` })
    if (error.status === 404) return json(404, { error: `no such room ${room}` })
    return json(502, { error: error.message })
  }
}
