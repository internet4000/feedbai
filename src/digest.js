/** Busy feeds: group items by conversation so an agent reads threads, not a firehose. */

const threadKey = (entry) => entry.thread ?? entry.replyTo ?? entry.id

/** [{ root, replies }] in order of first appearance; root is the earliest item we have. */
export const threads = (items) => {
  const byKey = new Map()
  for (const entry of items) {
    const key = threadKey(entry)
    const target = byKey.get(key) ?? byKey.get(entry.id)
    if (target) target.push(entry)
    else byKey.set(key, [entry])
  }
  return [...byKey.values()].map(([root, ...replies]) => ({ root, replies }))
}

export const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)
