import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const git = (args, cwd) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

/** git@github.com:a/b.git and https://github.com/a/b.git -> https://github.com/a/b */
export const httpsRemote = (remote) =>
  remote
    ?.replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/\.git$/, '') || undefined

const packageName = (root) => {
  const file = join(root, 'package.json')
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8')).name?.replace(/^@[^/]+\//, '') || null
  } catch {
    return null
  }
}

/** What we can infer about the project in `cwd` (git root, id, repository). */
export const detectProject = (cwd = process.cwd()) => {
  const root = git(['rev-parse', '--show-toplevel'], cwd) ?? cwd
  return {
    root,
    git: root !== cwd || git(['rev-parse', '--git-dir'], cwd) !== null,
    id: packageName(root) ?? basename(root),
    repository: httpsRemote(git(['remote', 'get-url', 'origin'], root)),
  }
}
