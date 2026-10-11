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
  const joined = await acceptInvites({ homeserver, token, fetchImpl })
  if (joined.length) log(`joined ${joined.length} room(s)`)

  for (const repo of await installedRepos({ appId: env.FEEDBAI_APP_ID, privateKey: env.FEEDBAI_APP_PRIVATE_KEY, fetchImpl })) {
    try {
      const config = await repoConfig({ ...repo, fetchImpl })
      if (!config) continue
      const { urls, errors } = await fileIssues({
        entries: selectSources(mergeConfigs(sanitize(config))),
        client: githubClient({ token: repo.token, repo: repo.fullName, fetchImpl }),
        since: SINCE,
      })
      log(`${repo.fullName}: ${urls.length} filed${errors.length ? `, ${errors.length} source error(s)` : ''}`)
      for (const e of errors) log(`  ${e.error}`)
    } catch (error) {
      log(`${repo.fullName}: ${error.message}`) // one broken repo never stops the others
    }
  }
}

if (process.argv?.[1] && process.argv[1] === fileURLToPath(import.meta.url)) await runHub()
