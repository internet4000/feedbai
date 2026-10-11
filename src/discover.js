import { execFileSync } from 'node:child_process'
import { parseRoom } from './providers/matrix.js'

/** Patterns for channel links a repository may already mention. */
const PATTERNS = [
  {
    regex: 'matrix\\.to/#/[#!][^] )"\'<>`]+',
    suggest: (link) => {
      const room = parseRoom(`https://${link}`)
      return [{ type: 'matrix', value: room, command: `feedbai add matrix '${room}'` }]
    },
  },
  {
    regex: 'bsky\\.app/profile/[a-zA-Z0-9.:-]+',
    suggest: (link) => {
      const actor = link.split('/').pop()
      return [{ type: 'bluesky', mode: 'author', value: actor, command: `feedbai add bluesky author ${actor}` }]
    },
  },
]

/** Tests, specs and examples link to made-up or other projects' channels. */
const EXCLUDE = [':!*test*', ':!*spec*', ':!*example*', ':!*fixture*']

const grep = (regex, root) => {
  try {
    return execFileSync('git', ['grep', '-hoIE', regex, '--', '.', ...EXCLUDE], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n')
      .filter(Boolean)
  } catch {
    return []
  }
}

/** Suggest sources from links found in tracked files, minus ones already configured. */
export const discover = (root, existing = []) => {
  const known = new Set(existing.map((s) => s.room ?? s.actor ?? s.query ?? s.post))
  const seen = new Set()
  return PATTERNS.flatMap(({ regex, suggest }) => [...new Set(grep(regex, root))].flatMap(suggest)).filter((s) => {
    if (known.has(s.value) || seen.has(s.command)) return false
    seen.add(s.command)
    return true
  })
}
