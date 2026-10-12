import { request } from '../http.js'
import { getSecret } from '../secrets.js'
import { item, requireFields } from '../model.js'
import { t } from '../i18n.js'

const GRAPHQL = 'https://api.github.com/graphql'
const DISCUSSIONS = 25 // most recently updated discussions read per run
const COMMENTS = 50
const REPLIES = 20

/** Accept "owner/name" or a github.com link to the repo (or anything under it). */
export const parseRepo = (repo) => {
  const match = /^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/.exec(repo.trim())
  return match ? { owner: match[1], name: match[2] } : null
}

const token = (account) => getSecret(account?.secrets?.token)

const QUERY = `query($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    discussions(first: ${DISCUSSIONS}, orderBy: { field: UPDATED_AT, direction: DESC }) {
      nodes {
        id url title body createdAt updatedAt author { login }
        comments(last: ${COMMENTS}) {
          nodes {
            id url body createdAt author { login }
            replies(last: ${REPLIES}) { nodes { id url body createdAt author { login } } }
          }
        }
      }
    }
  }
}`

/** A discussion is a thread: the post is its root, comments reply to it, replies to their comment. */
const flatten = (discussion, ctx) => {
  const at = (node, extra = {}) =>
    item({
      id: node.id,
      platform: 'github',
      project: ctx.project.id,
      source: ctx.source.id,
      author: { id: node.author?.login ?? 'ghost' }, // deleted users show as "ghost" on GitHub
      url: node.url,
      createdAt: node.createdAt,
      ...extra,
      text: extra.text ?? node.body,
    })
  const thread = discussion.id
  return [
    at(discussion, { text: `${discussion.title}\n\n${discussion.body}`.trim() }),
    ...discussion.comments.nodes.flatMap((comment) => [
      at(comment, { replyTo: thread, thread }),
      ...comment.replies.nodes.map((reply) => at(reply, { replyTo: comment.id, thread })),
    ]),
  ]
}

export default {
  type: 'github',

  validate(source) {
    requireFields(source, ['id', 'repo'], t)
    if (!parseRepo(source.repo)) throw new Error(t('error.missingField', { source: source.id, field: 'repo (owner/name)' }))
  },

  describe: (source) => `discussions ${source.repo}`,

  /** `feedbai add github discussions <owner/name>` */
  add: ([mode, repo]) => {
    if (mode !== 'discussions') throw new Error(t('error.missingField', { source: '(add)', field: 'github discussions <owner/name>' }))
    const parsed = repo && parseRepo(repo)
    return { repo: parsed ? `${parsed.owner}/${parsed.name}` : repo }
  },

  /** Discussion links a repository may already mention (e.g. "Questions? Ask in Discussions"). */
  discover: [
    {
      regex: 'github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/discussions',
      suggest: (link) => {
        const { owner, name } = parseRepo(`https://${link}`)
        return { value: `${owner}/${name}`, args: ['discussions', `${owner}/${name}`] }
      },
    },
  ],

  /** GitHub's GraphQL API always needs a token, even for public discussions. */
  needsAuth: () => true,

  authStatus: (account) => (!account ? 'none' : token(account) ? 'ok' : 'missing'),

  /** Account from the environment: GH_TOKEN or GITHUB_TOKEN (Actions, `gh`-style setups). */
  envAccount: (env) =>
    (env.GH_TOKEN || env.GITHUB_TOKEN) && {
      id: 'env-github',
      type: 'github',
      secrets: { token: env.GH_TOKEN ? 'GH_TOKEN' : 'GITHUB_TOKEN' },
    },

  /** `feedbai login github`: a token that can read the repo (fine-grained, "Discussions: read"; or `gh auth token`). */
  async authenticate({ account }, { promptHidden }) {
    const secret = await promptHidden(t('prompt.githubToken'))
    const { viewer } = (await request(GRAPHQL, { method: 'POST', token: secret, body: { query: '{ viewer { login } }' } })).data
    return { account: { id: account ?? `github-${viewer.login}`, type: 'github', user: viewer.login }, secrets: { token: secret } }
  },

  /** Discussions are read and triaged by agents; filing every post as an issue would just copy them. */
  files: () => false,

  async fetch({ project, source, account, since, limit, fetchImpl }) {
    const secret = token(account)
    if (!secret) throw new Error(t('error.authRequired', { source: source.id, mode: 'discussions', type: 'github' }))
    const { owner, name } = parseRepo(source.repo)
    const data = await request(GRAPHQL, { method: 'POST', token: secret, fetchImpl, body: { query: QUERY, variables: { owner, name } } })
    if (data.errors?.length) throw new Error(data.errors.map((e) => e.message).join('; '))
    const discussions = data.data?.repository?.discussions?.nodes ?? []
    return discussions
      .filter((d) => !since || new Date(d.updatedAt) >= since)
      .flatMap((d) => flatten(d, { project, source }))
      .filter((entry) => !since || new Date(entry.createdAt) >= since)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-limit)
  },
}
