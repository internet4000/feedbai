import { providers } from './providers/index.js'
import { LABEL } from './issues.js'

/**
 * Close the loop: when a `feedback` issue is fixed, reply once where the feedback was given ("🤖 Fixed: <issue>").
 * "Fixed" means closed by a pull request or commit ("Fixes #12"), or labelled `fixed`: closing a question or
 * noise (GitHub's default "Close" is also "completed") sends nothing.
 * Exactly once: the note with the hidden marker is written *before* posting (a failure can miss a reply, never
 * repeat one), and the Matrix send uses a stable transaction id. The reply is a fixed template: no model- or
 * user-written text is ever posted back.
 */
export const REPLIED = '<!-- feedbai:replied -->'
const RECENT = 7 * 24 * 3600 * 1000 // only issues closed in the last week (never a burst of replies to old ones)

/**
 * The thread to answer: the first quoted message's link. Only feedbai's own header lines count (quoted
 * user text starts with ">"), and the last link on the line (a display name could contain a fake one).
 */
export const threadLink = (body = '') => {
  for (const line of body.split('\n')) {
    if (line.startsWith('>')) continue
    const links = [...line.matchAll(/ · \[([a-z]+)\]\((https:\/\/[^)\s]+)\)/g)]
    if (links.length) {
      const [, platform, url] = links.at(-1)
      return { platform, url }
    }
  }
  return null
}

export const replyText = (issue) => `🤖 This is fixed, thank you for telling us: ${issue.html_url}`
export const FIXED_LABEL = 'fixed'

/** Closed by a pull request or commit (its last "closed" event has a commit), or labelled `fixed`. */
export const isFixed = (issue, timeline = []) =>
  issue.labels?.some((l) => (l.name ?? l) === FIXED_LABEL) || Boolean(timeline.filter((e) => e.event === 'closed').at(-1)?.commit_id)

/** Closed-as-completed feedback issues not answered yet, with where to answer (channels that can post). Fixed or not is checked when sending. */
export const planReplies = ({ issues, comments, now = Date.now() }) => {
  const replied = new Set(comments.filter((c) => c.body?.includes(REPLIED)).map((c) => Number(c.issue_url.split('/').pop())))
  return issues
    .filter((i) => i.state === 'closed' && i.state_reason === 'completed' && !i.pull_request && !replied.has(i.number))
    .filter((i) => now - Date.parse(i.closed_at) < RECENT)
    .map((issue) => ({ issue, link: threadLink(issue.body) }))
    .filter(({ link }) => link && providers[link.platform]?.post && providers[link.platform].parseLink?.(link.url))
}

/** Send the replies a repo owes, with the given accounts ({ matrix: account }). Returns the posted links. */
export const sendReplies = async ({ client, accounts, fetchImpl, now }) => {
  const plans = planReplies({ issues: await client.issues(LABEL), comments: await client.comments(), now })
  const sent = []
  for (const { issue, link } of plans) {
    const account = accounts[link.platform]
    if (!account) continue
    if (!isFixed(issue, await client.timeline(issue.number))) continue
    const provider = providers[link.platform]
    // Claim first: if anything below fails, the next run sees the marker and never posts twice
    const note = await client.comment(issue.number, `Replying where the feedback was given…\n\n${REPLIED}`)
    const posted = await provider.post({ account, ...provider.parseLink(link.url), text: replyText(issue), txn: `feedbai-fixed-${client.repo}-${issue.number}`.replace(/[^\w.-]/g, '-'), fetchImpl })
    await client.editComment(note.id, `Replied where the feedback was given: ${posted}\n\n${REPLIED}`).catch(() => {})
    sent.push(posted)
  }
  return sent
}
