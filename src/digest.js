/** Busy feeds: group items by conversation so an agent reads threads, not a firehose. */

/**
 * [{ root, replies }] in order of first appearance; root is the earliest item we have.
 * Reply chains (a reply to a reply) stay in one thread.
 */
export const threads = (items) => {
  const keyOf = new Map()
  const byKey = new Map()
  for (const entry of items) {
    const key = keyOf.get(entry.edits) ?? keyOf.get(entry.replyTo) ?? entry.thread ?? entry.replyTo ?? entry.edits ?? entry.id
    keyOf.set(entry.id, key)
    if (byKey.has(key)) byKey.get(key).push(entry)
    else byKey.set(key, [entry])
  }
  return [...byKey.values()].map(([root, ...replies]) => ({ root, replies }))
}

export const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)
