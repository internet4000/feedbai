import { request, query } from '../http.js'
import { getSecret } from '../secrets.js'
import { item, requireFields } from '../model.js'
import { t } from '../i18n.js'

const PUBLIC_APPVIEW = 'https://public.api.bsky.app'
const DEFAULT_SERVICE = 'https://bsky.social'
const PAGE = 100
const NOTIFICATION_REASONS = ['mention', 'reply', 'quote']

/** Which source fields each mode needs, and whether it needs an account. */
const MODES = {
  search: { fields: ['query'], auth: true },
  author: { fields: ['actor'], auth: false },
  thread: { fields: ['post'], auth: false },
  mentions: { fields: [], auth: true },
}

const xrpc = (base, method, params) => `${base}/xrpc/${method}?${query(params)}`

/** Convert a bsky.app post link to an AT URI; pass AT URIs through. */
export const toAtUri = (post) => {
  const match = /bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/.exec(post)
  return match ? `at://${match[1]}/app.bsky.feed.post/${match[2]}` : post
}

const postUrl = (uri, handle) => `https://bsky.app/profile/${handle}/post/${uri.split('/').pop()}`

const toItem = ({ uri, author, record, project, source }) =>
  item({
    id: uri,
    platform: 'bluesky',
    project: project.id,
    source: source.id,
    author: { id: author.handle, ...(author.displayName && { name: author.displayName }) },
    text: record.text,
    url: postUrl(uri, author.handle),
    createdAt: record.createdAt,
    replyTo: record.reply?.parent?.uri,
    thread: record.reply?.root?.uri,
  })

const fromPost = (post, ctx) => toItem({ ...post, ...ctx })

const password = (account) => getSecret(account?.secrets?.password)

/** One session per account per process. */
const sessions = new Map()
const session = async (account, fetchImpl) => {
  if (!sessions.has(account.id)) {
    const service = account.service ?? DEFAULT_SERVICE
    const promise = request(`${service}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      fetchImpl,
      body: { identifier: account.identifier, password: password(account) },
    }).then((data) => ({ base: service, token: data.accessJwt, handle: data.handle }))
    sessions.set(account.id, promise)
  }
  return sessions.get(account.id)
}

/** Follow a cursor until `limit` items or items older than `since`. */
const paginate = async ({ fetchPage, toItems, limit, since }) => {
  const items = []
  let cursor
  while (items.length < limit) {
    const page = await fetchPage(cursor)
    const batch = toItems(page)
    for (const entry of batch) {
      if (since && new Date(entry.createdAt) < since) return items
      items.push(entry)
      if (items.length >= limit) return items
    }
    if (!page.cursor || !batch.length) return items
    cursor = page.cursor
  }
  return items
}

const flattenThread = (node, ctx, out = []) => {
  if (node?.post) out.push(fromPost(node.post, ctx))
  for (const reply of node?.replies ?? []) flattenThread(reply, ctx, out)
  return out
}

const fetchers = {
  search: ({ api, source, since, limit, ctx }) =>
    paginate({
      limit,
      since,
      fetchPage: (cursor) =>
        api('app.bsky.feed.searchPosts', {
          q: source.query,
          sort: 'latest',
          since: since?.toISOString(),
          limit: Math.min(PAGE, limit),
          cursor,
        }),
      toItems: (page) => page.posts.map((p) => fromPost(p, ctx)),
    }),

  author: ({ api, source, since, limit, ctx }) =>
    paginate({
      limit,
      since,
      fetchPage: (cursor) =>
        api('app.bsky.feed.getAuthorFeed', {
          actor: source.actor,
          filter: source.filter ?? 'posts_with_replies',
          limit: Math.min(PAGE, limit),
          cursor,
        }),
      toItems: (page) => page.feed.filter((f) => !f.reason).map((f) => fromPost(f.post, ctx)),
    }),

  thread: async ({ api, source, since, limit, ctx }) => {
    const data = await api('app.bsky.feed.getPostThread', { uri: toAtUri(source.post), depth: source.depth ?? 10 })
    return flattenThread(data.thread, ctx)
      .filter((entry) => !since || new Date(entry.createdAt) >= since)
      .slice(0, limit)
  },

  mentions: ({ api, since, limit, ctx }) =>
    paginate({
      limit,
      since,
      fetchPage: (cursor) =>
        api('app.bsky.notification.listNotifications', {
          reasons: NOTIFICATION_REASONS,
          limit: Math.min(PAGE, limit),
          cursor,
        }),
      toItems: (page) =>
        page.notifications
          .filter((n) => NOTIFICATION_REASONS.includes(n.reason))
          .map((n) => toItem({ uri: n.uri, author: n.author, record: n.record, ...ctx })),
    }),
}

export default {
  type: 'bluesky',

  validate(source) {
    requireFields(source, ['id', 'mode'], t)
    const mode = MODES[source.mode]
    if (!mode) throw new Error(t('error.missingField', { source: source.id, field: `mode (${Object.keys(MODES).join('|')})` }))
    requireFields(source, mode.fields, t)
  },

  needsAuth: (source) => MODES[source.mode].auth,

  authStatus: (account) => (!account ? 'none' : password(account) ? 'ok' : 'missing'),

  async fetch({ project, source, account, since, limit, fetchImpl }) {
    const authed = account && password(account)
    if (MODES[source.mode].auth && !authed) {
      throw new Error(t('error.authRequired', { source: source.id, mode: source.mode, type: 'bluesky' }))
    }
    const { base, token } = authed ? await session(account, fetchImpl) : { base: PUBLIC_APPVIEW }
    const api = (method, params) => request(xrpc(base, method, params), { token, fetchImpl })
    const items = await fetchers[source.mode]({ api, source, since, limit, ctx: { project, source } })
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  },

  /** Verify an app password; returns the canonical handle. */
  async login({ service = DEFAULT_SERVICE, identifier, password: secret, fetchImpl }) {
    const data = await request(`${service}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      fetchImpl,
      body: { identifier, password: secret },
    })
    return { handle: data.handle, did: data.did }
  },
}
