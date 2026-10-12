import { execFileSync } from 'node:child_process'
import { detectProject } from './project.js'

// CLI only (child_process, git): src/github.js stays runtime-agnostic for the hub.

/** Token from the environment (CI), else from an installed `gh` login. */
export const githubToken = () => {
  if (process.env.GH_TOKEN || process.env.GITHUB_TOKEN) return process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

/** owner/repo from GH_REPO, GITHUB_REPOSITORY (Actions) or the git remote. */
export const githubRepo = () =>
  process.env.GH_REPO ||
  process.env.GITHUB_REPOSITORY ||
  detectProject().repository?.match(/github\.com\/([^/]+\/[^/]+)/)?.[1]
