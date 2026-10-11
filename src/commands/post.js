import { loadConfig, selectSources } from '../config.js'
import { providers } from '../providers/index.js'
import { t } from '../i18n.js'
import { out } from './shared.js'

/** Every message feedbai sends says it comes from an agent. */
const LABEL = '🤖 '

/** Message from the remaining words, or stdin when it is "-". */
const message = async (words) => {
  if (words.join(' ') !== '-') return words.join(' ')
  let text = ''
  for await (const chunk of process.stdin) text += chunk
  return text.trim()
}

/**
 * `feedbai post <target> <text>`: target is an item link (matrix.to/#/!room/$event → reply
 * in that thread) or a source id (new message in that source's room). Matrix only for now.
 */
export default async ({ opts, args }) => {
  const [target, ...words] = args
  const text = await message(words)
  if (!target || !text) throw new Error(t('error.missingField', { source: 'post', field: '<target> <text>' }))
  const { config } = loadConfig({ explicit: opts.config })
  let room
  let replyTo
  let account
  if (target.startsWith('https://matrix.to/#/')) {
    ;[room, replyTo] = decodeURIComponent(target.replace('https://matrix.to/#/', '').split('?')[0]).split('/')
    account = config.accounts.find((a) => a.type === 'matrix' && (!opts.account || a.id === opts.account))
  } else {
    const [entry] = selectSources(config, { project: opts.project, source: target })
    if (entry?.source.type !== 'matrix') throw new Error(t('error.badTarget', { target }))
    room = entry.source.room
    account = entry.account
  }
  out(await providers.matrix.post({ account, room, replyTo, text: LABEL + text }))
}
