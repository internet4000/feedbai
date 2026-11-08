/**
 * Addresses feedbai reads from configs, messages and links, parsed in one place so every part agrees
 * (the CLI, the providers, the sign-in page). The Feedback button (site/public/embed.js) is a single
 * self-hostable file with its own copy; test/links.test.js checks both give the same answers.
 */

const GITHUB = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w-]+)\/([\w.-]+?)(?:\.git)?(\/.*|[?#].*)?$/i
const SHORT = /^([\w-]+)\/([\w.-]+?)(?:\.git)?\/?$/

/**
 * A GitHub repository: "owner/name", "github.com/owner/name", or a link to it. `strict`: the repository
 * itself only, not a link to something in it (an issue, a discussion): what a project names.
 */
export const parseRepo = (value = '', { strict = false } = {}) => {
  const text = String(value).trim()
  const match = GITHUB.exec(text)
  if (match) return strict && match[3] && match[3] !== '/' ? null : { owner: match[1], name: match[2] }
  const short = SHORT.exec(text)
  return short ? { owner: short[1], name: short[2] } : null
}

/** A project as feedback records name it: its repository as a full URL (indexes only see URLs). */
export const projectUri = (value) => {
  const repo = parseRepo(value, { strict: true })
  return repo ? `https://github.com/${repo.owner}/${repo.name}` : null
}

/** The page feedback is about: origin and path only. Query strings and fragments can hold tokens or personal data. */
export const pageAddress = (href) => {
  try {
    const url = new URL(href)
    return /^https?:$/.test(url.protocol) ? `${url.origin}${url.pathname}` : ''
  } catch {
    return ''
  }
}
