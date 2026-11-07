/**
 * GET /v1/status: does each of the hub's secrets still work? For the hourly health check (and anyone curious),
 * so a revoked or expired secret is noticed in an hour, not when someone wonders why nothing gets filed.
 * Says only "ok", "rejected" (the secret was refused: rotate it, SECURITY.md) or "unreachable"; never details.
 */
import { request } from '../src/http.js'
import { appJwt } from './github.js'

const check = async (fn) => {
  try {
    await fn()
    return 'ok'
  } catch (error) {
    return [400, 401, 403].includes(error.status) ? 'rejected' : 'unreachable'
  }
}

export const readStatus = async ({ env, fetchImpl }) => {
  const homeserver = (env.FEEDBAI_MATRIX_HOMESERVER ?? 'https://matrix.org').replace(/\/$/, '')
  const [matrix, github, bluesky] = await Promise.all([
    env.FEEDBAI_MATRIX_TOKEN ? check(() => request(`${homeserver}/_matrix/client/v3/account/whoami`, { token: env.FEEDBAI_MATRIX_TOKEN, fetchImpl })) : 'unset',
    env.FEEDBAI_APP_ID && env.FEEDBAI_APP_PRIVATE_KEY ? check(() => request('https://api.github.com/app', { token: appJwt(env.FEEDBAI_APP_ID, env.FEEDBAI_APP_PRIVATE_KEY), fetchImpl })) : 'unset',
    env.FEEDBAI_BLUESKY_PASSWORD
      ? check(() => request('https://bsky.social/xrpc/com.atproto.server.createSession', { method: 'POST', body: { identifier: env.FEEDBAI_BLUESKY_IDENTIFIER, password: env.FEEDBAI_BLUESKY_PASSWORD }, fetchImpl }))
      : 'unset',
  ])
  const checks = { matrix, github, bluesky }
  const ok = matrix === 'ok' && github === 'ok' && bluesky !== 'rejected' && bluesky !== 'unreachable'
  return new Response(JSON.stringify({ ok, checks, version: env.CF_VERSION_METADATA?.id ?? null }), {
    status: ok ? 200 : 503,
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
  })
}
