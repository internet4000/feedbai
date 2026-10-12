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

export const item = (fields) => ({
  id: fields.id,
  platform: fields.platform,
  project: fields.project,
  source: fields.source,
  author: fields.author,
  text: fields.text ?? '',
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
