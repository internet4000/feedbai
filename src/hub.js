import { request, query } from './http.js'
import { item } from './model.js'
import { t } from './i18n.js'

/**
 * The feedbai hub reads public channels with its own accounts, for people without one
 * (public Matrix rooms its bot was invited to, Bluesky searches). FEEDBAI_HUB=off disables it.
 */
export const hubUrl = (env = process.env) =>
  env.FEEDBAI_HUB === 'off' ? null : (env.FEEDBAI_HUB || 'https://feedbai.internet4000.com').replace(/\/$/, '')

/**
 * Inside a GitHub Actions run with `permissions: id-token: write`, a short-lived token signed by GitHub that
 * proves which repository is asking (audience: the hub). The hub then serves that repository's rooms and
 * ✅s for it: projects need no secret of their own. Null anywhere else.
 */
let identity
export const hubIdentity = async ({ env = process.env, fetchImpl = fetch } = {}) => {
  if (!env.ACTIONS_ID_TOKEN_REQUEST_URL || !env.ACTIONS_ID_TOKEN_REQUEST_TOKEN || !hubUrl(env)) return null
  identity ??= request(`${env.ACTIONS_ID_TOKEN_REQUEST_URL}&audience=${encodeURIComponent(hubUrl(env))}`, { token: env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, fetchImpl })
    .then((data) => data.value ?? null)
    .catch(() => null)
  return identity
}

/** ✅ on a message through the hub's bot, for this repository (GitHub Actions identity): a fixed reaction only. */
export const reactViaHub = async ({ link, fetchImpl }) => {
  const token = await hubIdentity({ fetchImpl })
  if (!token) throw new Error(t('error.noHubIdentity'))
  const { reacted } = await request(`${hubUrl()}/v1/matrix/react`, { method: 'POST', token, body: { link }, fetchImpl })
  return reacted
}

/** GET `path` on the hub; items are relabelled as the caller's project/source. */
export const readViaHub = async ({ path, params, platform, project, source, fetchImpl }) => {
  const url = `${hubUrl()}${path}?${query(params)}`
  try {
    const { items = [], notices = [] } = await request(url, { token: await hubIdentity({ fetchImpl }), fetchImpl })
    return { items: items.map((fields) => item({ ...fields, platform, project: project.id, source: source.id })), notices }
  } catch (error) {
    if (error.data?.error) throw new Error(t('error.hub', { source: source.id, reason: error.data.error }))
    // Down, unreachable or not a hub: say so, and how to read without it. Never a silent failure.
    throw new Error(t('error.hubDown', { source: source.id, hub: hubUrl(), reason: error.cause?.code ?? error.status ?? error.message, login: t(`channel.${source.type}.hint`) }))
  }
}
