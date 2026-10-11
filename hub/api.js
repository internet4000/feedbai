/**
 * The hub's read API: feedback from public Matrix rooms the bot was invited to, for anyone
 * running feedbai without a Matrix account (the CLI falls back to it). Same items as `feedbai fetch`.
 * GET /v1/matrix?room=#room:server[&since=ISO][&limit=n]
 * GET /v1/bluesky/search?query=…[&since=ISO][&limit=n] (Bluesky search needs an account; the hub's)
 */
import matrix from '../src/providers/matrix.js'
import bluesky from '../src/providers/bluesky.js'
import { roomPublic } from './matrix.js'

const MAX_LIMIT = 100
const CACHE_SECONDS = 60

const json = (status, data) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': `public, max-age=${CACHE_SECONDS}` },
  })

const readWindow = (params) => {
  const since = params.get('since') ? new Date(params.get('since')) : null
  if (since && Number.isNaN(since.getTime())) return { error: json(400, { error: 'since must be an ISO date' }) }
  return { since, limit: Math.min(Number(params.get('limit')) || 50, MAX_LIMIT) }
}

export const readMatrix = async ({ params, env, fetchImpl }) => {
  const room = params.get('room')
  if (!room) return json(400, { error: 'missing ?room=#room:server' })
  const { since, limit, error } = readWindow(params)
  if (error) return error

  const homeserver = env.FEEDBAI_MATRIX_HOMESERVER ?? 'https://matrix.org'
  const bot = env.FEEDBAI_MATRIX_USER
  const invite = `invite ${bot} to ${room}, or read it with your own account (feedbai login matrix)`
  try {
    if (!(await roomPublic({ homeserver, token: env.FEEDBAI_MATRIX_TOKEN, room, fetchImpl }))) {
      return json(403, { error: `${room} is not public; the hub only serves public rooms` })
    }
    const account = { id: 'hub', type: 'matrix', homeserver, user: bot, secrets: { token: 'FEEDBAI_MATRIX_TOKEN' } }
    const source = { id: 'matrix', type: 'matrix', room }
    const { items, notices } = await matrix.fetch({ project: { id: 'hub' }, source, account, since, limit, fetchImpl })
    return json(200, { room, items, notices })
  } catch (error) {
    if (error.status === 403) return json(403, { error: `the hub's bot is not in ${room}: ${invite}` })
    if (error.status === 404) return json(404, { error: `no such room ${room}` })
    return json(502, { error: error.message })
  }
}

export const readBlueskySearch = async ({ params, env, fetchImpl }) => {
  const query = params.get('query')
  if (!query) return json(400, { error: 'missing ?query=' })
  const { since, limit, error } = readWindow(params)
  if (error) return error
  if (!env.FEEDBAI_BLUESKY_PASSWORD) return json(503, { error: 'this hub has no Bluesky account' })
  const account = { id: 'hub-bluesky', type: 'bluesky', identifier: env.FEEDBAI_BLUESKY_IDENTIFIER, secrets: { password: 'FEEDBAI_BLUESKY_PASSWORD' } }
  try {
    const items = await bluesky.fetch({ project: { id: 'hub' }, source: { id: 'search', type: 'bluesky', mode: 'search', query }, account, since, limit, fetchImpl })
    return json(200, { query, items })
  } catch (error) {
    return json(502, { error: error.message })
  }
}
