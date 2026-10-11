#!/usr/bin/env node
/**
 * feedbai hub: one scheduled run for every project that installed the feedbai GitHub App.
 * accept room invites → for each installed repo: read its feedbai.config.json,
 * keep only rooms it may read, run `feedbai issues` with the installation token.
 * Env: FEEDBAI_APP_ID, FEEDBAI_APP_PRIVATE_KEY, FEEDBAI_MATRIX_TOKEN, FEEDBAI_MATRIX_USER,
 *      optional FEEDBAI_MATRIX_HOMESERVER, FEEDBAI_BLUESKY_IDENTIFIER/_PASSWORD.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { installedRepos, repoConfig } from './github.js'
import { acceptInvites, roomAllowed } from './matrix.js'

const CLI = fileURLToPath(new URL('../src/cli.js', import.meta.url))
const SINCE = '1h' // runs are idempotent; the window only needs to cover missed schedules

/** Hub-safe copy of a repo's config: the hub's own accounts only, no joins, only allowed rooms. */
export const sanitize = async (config, allowed) => {
  const projects = []
  for (const project of config.projects ?? []) {
    const sources = []
    for (const { account, join, ...source } of project.sources ?? []) {
      if (source.type !== 'matrix' || (await allowed(source.room))) sources.push(source)
    }
    projects.push({ ...project, sources })
  }
  return { projects }
}

const main = async () => {
  const env = process.env
  const homeserver = env.FEEDBAI_MATRIX_HOMESERVER ?? 'https://matrix.org'
  const token = env.FEEDBAI_MATRIX_TOKEN
  const joined = await acceptInvites({ homeserver, token })
  if (joined.length) console.log(`joined ${joined.length} room(s)`)

  for (const repo of await installedRepos({ appId: env.FEEDBAI_APP_ID, privateKey: env.FEEDBAI_APP_PRIVATE_KEY })) {
    try {
      const config = await repoConfig(repo)
      if (!config) continue
      const safe = await sanitize(config, (room) => roomAllowed({ homeserver, token, room, repo: repo.fullName }))
      const file = join(mkdtempSync(join(tmpdir(), 'feedbai-hub-')), 'feedbai.config.json')
      writeFileSync(file, JSON.stringify(safe))
      const output = execFileSync('node', [CLI, 'issues', '--config', file, '--since', SINCE], {
        env: { ...env, GH_TOKEN: repo.token, GH_REPO: repo.fullName, XDG_CONFIG_HOME: join(file, '..') },
        encoding: 'utf8',
      })
      console.log(`${repo.fullName}: ${output.trim()}`)
    } catch (error) {
      // exit code 2 = some sources failed; report and continue with the next repo
      console.error(`${repo.fullName}: ${(error.stdout ?? '').trim()} ${error.message.split('\n')[0]}`)
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
