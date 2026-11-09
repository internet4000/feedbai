#!/usr/bin/env node
/**
 * feedbai hub: one scheduled run for every project that installed the feedbai GitHub App.
 * accept room invites → for each installed repo: read its feedbai.config.json, drop what a
 * repo may not choose, run `feedbai issues` with the installation token (which files only
 * public rooms, or private ones whose topic names the repo: providers' `mayFile`).
 * Env: FEEDBAI_APP_ID, FEEDBAI_APP_PRIVATE_KEY, FEEDBAI_MATRIX_TOKEN, FEEDBAI_MATRIX_USER,
 *      optional FEEDBAI_MATRIX_HOMESERVER, FEEDBAI_BLUESKY_IDENTIFIER/_PASSWORD.
 */
import { fileURLToPath } from 'node:url'
import { mergeConfigs, selectSources } from '../src/config.js'
import { fileIssues } from '../src/issues.js'
import { githubClient } from '../src/github.js'
import { installedRepos, repoConfig } from './github.js'
import { acceptInvites } from './matrix.js'
import { allows, listed, topicAllowed } from './allow.js'
import { sendReplies } from '../src/replies.js'
import { providers } from '../src/providers/index.js'

const SINCE = '1h' // runs are idempotent; the window only needs to cover missed schedules

/** Hub-safe copy of a repo's config: the hub's own accounts only, no joins, no mentions. */
export const sanitize = (config) => ({
  projects: (config.projects ?? []).map((project) => ({
    ...project,
    sources: (project.sources ?? [])
      .map(({ account, join, ...source }) => source)
      // Bluesky mentions are the reading account's: here the hub's own, never a repo's
      .filter((source) => !(source.type === 'bluesky' && source.mode === 'mentions')),
  })),
})

/**
 * One hub run, runtime-agnostic (fetch only): call it from Node (hub/run.js), cron,
 * or a serverless scheduled handler. The hub's accounts come from FEEDBAI_MATRIX_* /
 * FEEDBAI_BLUESKY_* in process.env; repos' configs never bring their own.
 */
export const runHub = async ({ env = process.env, fetchImpl, log = console.log } = {}) => {
  const homeserver = env.FEEDBAI_MATRIX_HOMESERVER ?? 'https://matrix.org'
  const token = env.FEEDBAI_MATRIX_TOKEN
  // Matrix down must not stop filing for repos that don't use it
  const rooms = await acceptInvites({ homeserver, token, fetchImpl, topicOk: listed(env) ? (topic) => topicAllowed(env, topic) : null }).catch((error) => (log(`matrix: ${error.message}`), null))
  if (rooms) log(`matrix: ${rooms.joined.length + rooms.declined.length} new invite(s), ${rooms.left.length} room(s) left`)
  if (rooms?.joined.length) log(`joined ${rooms.joined.length} public room(s)`)
  if (rooms?.declined.length) log(`declined ${rooms.declined.length} invite(s) to non-public rooms${listed(env) ? ' or rooms of unlisted projects' : ''}`)
  if (rooms?.left.length) log(`left ${rooms.left.length} room(s) that are no longer public${listed(env) ? ' or no longer name a listed project' : ''}`)

  const installed = await installedRepos({ appId: env.FEEDBAI_APP_ID, privateKey: env.FEEDBAI_APP_PRIVATE_KEY, fetchImpl })
  // An invite-only hub (FEEDBAI_PROJECTS) works only for its listed projects, whoever installs the App
  const repos = installed.filter((repo) => allows(env, repo.fullName))
  if (repos.length < installed.length) log(`${installed.length - repos.length} repo(s) with the GitHub App skipped: not listed in FEEDBAI_PROJECTS`)
  log(`${repos.length} repo(s) with the GitHub App${repos.length ? '' : ': nothing to file (install it on a repo)'}`)
  for (const repo of repos) {
    try {
      const config = await repoConfig({ ...repo, fetchImpl })
      if (!config) continue
      const client = githubClient({ token: repo.token, repo: repo.fullName, fetchImpl })
      // A project whose own agent triages ("filing": "agent") gets no raw copies of mentions from the hub (#70)
      if (config.projects?.some((p) => p.filing === 'agent')) log(`${repo.fullName}: filing by its agent`)
      else {
        const { urls, errors } = await fileIssues({ entries: selectSources(mergeConfigs(sanitize(config))), client, since: SINCE })
        log(`${repo.fullName}: ${urls.length} filed${errors.length ? `, ${errors.length} source error(s)` : ''}`)
        for (const e of errors) log(`  ${e.error}`)
      }
      // Close the loop: answer where the feedback was given, once its issue is fixed (closed by a PR or commit, or labelled fixed)
      if (!config.projects?.some((p) => p.replies === false)) {
        const sent = await sendReplies({ client, accounts: { matrix: providers.matrix.envAccount(env) }, fetchImpl }).catch((error) => {
          log(`${repo.fullName}: replies: ${error.message}`)
          return []
        })
        if (sent.length) log(`${repo.fullName}: ${sent.length} replied`)
      }
    } catch (error) {
      log(`${repo.fullName}: ${error.message}`) // one broken repo never stops the others
    }
  }
}

if (process.argv?.[1] && process.argv[1] === fileURLToPath(import.meta.url)) await runHub()
