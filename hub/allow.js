/**
 * Which projects may use this hub (its bots, its accounts, its scheduled runs)? FEEDBAI_PROJECTS, a public,
 * comma-separated list of GitHub repositories ("owner/name"), kept in wrangler.jsonc so every change is a
 * reviewed commit. Unset: open to every project (a hub you run for yourself). Set, even empty: only those.
 * Everything else in feedbai (the CLI with your own accounts, the Feedback button, your own hub) stays open.
 */
import { topicNamesRepo } from '../src/providers/matrix.js'

export const INVITE_ONLY =
  'This feedbai hub is invite-only for now. Read with your own account (feedbai login …), or run your own hub: https://feedbai.internet4000.com/docs/hub/'

/** The listed repositories (lowercase), or null when the hub is open to all. */
export const listed = (env = {}) =>
  typeof env.FEEDBAI_PROJECTS === 'string'
    ? env.FEEDBAI_PROJECTS.split(',')
        .map((repo) => repo.trim().toLowerCase())
        .filter(Boolean)
    : null

/** May this repository ("owner/name") use the hub? */
export const allows = (env, repo) => {
  const repos = listed(env)
  return !repos || repos.includes(String(repo ?? '').toLowerCase())
}

/** Is this room tied to a listed project (its topic names one of the repositories)? Always true when open. */
export const topicAllowed = (env, topic = '') => {
  const repos = listed(env)
  return !repos || repos.some((repo) => topicNamesRepo(topic, repo))
}
