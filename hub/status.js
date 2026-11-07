/**
 * GET /v1/status: does each of the hub's secrets still work? For the hourly health check (and anyone curious),
 * so a revoked or expired secret is noticed in an hour, not when someone wonders why nothing gets filed.
 * Says only "ok", "rejected" (the secret was refused: rotate it, SECURITY.md) or "unreachable"; never details.
 */
import { request } from '../src/http.js'
import { appJwt } from './github.js'
import { session as blueskySession } from '../src/providers/bluesky.js'

const check = async (fn) => {
  try {
    await fn()
    return 'ok'
  } catch (error) {
    return [400, 401, 403].includes(error.status) ? 'rejected' : error.status === 429 ? 'rate-limited' : 'unreachable'
  }
}

export const readStatus = async ({ env, fetchImpl }) => {
  const homeserver = (env.FEEDBAI_MATRIX_HOMESERVER ?? 'https://matrix.org').replace(/\/$/, '')
  const [matrix, github, bluesky] = await Promise.all([
    env.FEEDBAI_MATRIX_TOKEN ? check(() => request(`${homeserver}/_matrix/client/v3/account/whoami`, { token: env.FEEDBAI_MATRIX_TOKEN, fetchImpl })) : 'unset',
    env.FEEDBAI_APP_ID && env.FEEDBAI_APP_PRIVATE_KEY ? check(() => request('https://api.github.com/app', { token: appJwt(env.FEEDBAI_APP_ID, env.FEEDBAI_APP_PRIVATE_KEY), fetchImpl })) : 'unset',
    // The same session the read API uses: Bluesky rate-limits logins, so a status check must not log in each time
    env.FEEDBAI_BLUESKY_PASSWORD
      ? check(() => blueskySession({ id: 'hub-bluesky', type: 'bluesky', identifier: env.FEEDBAI_BLUESKY_IDENTIFIER, did: env.FEEDBAI_BLUESKY_DID, secrets: { password: 'FEEDBAI_BLUESKY_PASSWORD' } }, fetchImpl))
      : 'unset',
  ])
  const checks = { matrix, github, bluesky }
  const ok = matrix === 'ok' && github === 'ok' && ['ok', 'unset', 'rate-limited'].includes(bluesky)
  return new Response(JSON.stringify({ ok, checks, version: env.CF_VERSION_METADATA?.id ?? null }), {
    status: ok ? 200 : 503,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
  })
}
