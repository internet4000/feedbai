import { request, query } from './http.js'
import { item } from './model.js'
import { t } from './i18n.js'

/**
 * A feedbai hub reads public channels with its own accounts, for people without one
 * (public Matrix rooms its bot was invited to, Bluesky searches). Opt-in: FEEDBAI_HUB=<url>
 * of a hub you run or trust. There is no default hub (docs/vision.md: no infrastructure of ours).
 */
export const hubUrl = (env = process.env) =>
  env.FEEDBAI_HUB && env.FEEDBAI_HUB !== 'off' ? env.FEEDBAI_HUB.replace(/\/$/, '') : null

/** GET `path` on the hub; items are relabelled as the caller's project/source. */
export const readViaHub = async ({ path, params, platform, project, source, fetchImpl }) => {
  const url = `${hubUrl()}${path}?${query(params)}`
  try {
    const { items = [], notices = [] } = await request(url, { fetchImpl })
    return { items: items.map((fields) => item({ ...fields, platform, project: project.id, source: source.id })), notices }
  } catch (error) {
    if (!error.data?.error) throw error
    throw new Error(t('error.hub', { source: source.id, reason: error.data.error }))
  }
}
