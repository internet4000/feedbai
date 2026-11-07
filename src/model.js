/**
 * Normalized feedback item, identical for every platform.
 * @typedef {object} FeedbackItem
 * @property {string} id         Platform id (Matrix event id, AT URI, ...)
 * @property {string} platform   provider type: matrix | bluesky | github | …
 * @property {string} project    Project id
 * @property {string} source     Source id
 * @property {{id: string, name?: string}} author
 * @property {string} text
 * @property {string} url        Link a human can open
 * @property {string} createdAt  ISO date
 * @property {string} [replyTo]  id of the item this replies to
 * @property {string} [thread]   id of the thread root
 * @property {'self'|'agent'|'maintainer'} [role]  set by roles.js
 * @property {string} [edits]   id of the item this one edits (new text)
 * @property {string[]} [mentions]  user ids explicitly mentioned (Matrix m.mentions)
 * @property {boolean} [toSelf]  mentions the account feedbai reads with; set by roles.js
 */

/**
 * Kept out of all output: terminal control codes (ANSI escapes can rewrite what a person sees in the
 * terminal), bidirectional overrides (text reads differently than it is), and invisible characters
 * (Unicode tags U+E0000–E007F, zero-width space/joiners' invisible kin, word joiner, BOM) that can hide
 * instructions an AI agent reads but a person reviewing the issue doesn't see. ZWJ/ZWNJ (U+200C/D) stay:
 * emoji sequences and several scripts need them.
 */
const UNSAFE = /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]|[\u{e0000}-\u{e007f}]/gu
export const clean = (text) => (typeof text === 'string' ? text.replace(UNSAFE, '') : text)

export const item = (fields) => ({
  id: fields.id,
  platform: fields.platform,
  project: fields.project,
  source: fields.source,
  // A name is one line: a newline in a display name could forge an issue's header line (where replies go)
  author: { ...fields.author, ...(fields.author?.name && { name: clean(fields.author.name).replace(/\s+/g, ' ').trim() }) },
  text: clean(fields.text ?? ''),
  url: fields.url,
  createdAt: fields.createdAt,
  ...(fields.replyTo && { replyTo: fields.replyTo }),
  ...(fields.thread && { thread: fields.thread }),
  ...(fields.mentions?.length && { mentions: fields.mentions }),
  ...(fields.edits && { edits: fields.edits }),
})

/** Throw if any of `fields` is missing on `source`. */
export const requireFields = (source, fields, t) => {
  for (const field of fields) {
    if (source[field] === undefined || source[field] === '') {
      throw new Error(t('error.missingField', { source: source.id, field }))
    }
  }
}
