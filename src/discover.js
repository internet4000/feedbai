import { execFileSync } from 'node:child_process'
import { providers } from './providers/index.js'

/** Each provider's `discover` patterns: links to its channels a repository may already mention. */
const patterns = () =>
  Object.values(providers).flatMap((provider) =>
    (provider.discover ?? []).map(({ regex, suggest }) => ({
      regex,
      suggest: (link) => {
        const found = suggest(link) // null: not a real channel (e.g. a placeholder in docs)
        if (!found) return []
        const { value, args } = found
        return { type: provider.type, value, command: ['feedbai add', provider.type, ...args].join(' ') }
      },
    })),
  )

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
  const known = new Set(existing.flatMap((s) => Object.values(s))) // a room, query, actor… already followed
  const seen = new Set()
  return patterns().flatMap(({ regex, suggest }) => [...new Set(grep(regex, root))].flatMap(suggest)).filter((s) => {
    if (known.has(s.value) || seen.has(s.command)) return false
    seen.add(s.command)
    return true
  })
}
