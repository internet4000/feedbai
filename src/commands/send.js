import { loadConfig } from '../config.js'
import { providers } from '../providers/index.js'
import { session } from '../providers/bluesky.js'
import { githubClient } from '../github.js'
import { githubToken } from '../gh.js'
import { readState, writeState } from '../state.js'
import { resolveTarget, ways, compose, postToBluesky, countSend, DAILY_CAP } from '../send.js'
import { t } from '../i18n.js'
import { out } from './shared.js'

/** Single-quoted for a POSIX shell: the person's text can hold $, backticks, quotes. */
const shq = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`

/**
 * `feedbai send <site | owner/repo> "text" [--title "…"] [--via issue|matrix|bluesky --yes]`: feedback to another
 * project, from the person's own accounts. Without --yes it only shows the draft and the ways to send it; an
 * agent shows that to the person and sends only the way they chose, after they said yes.
 */
export default async ({ opts, args }) => {
  const [target, ...words] = args
  const typed = words.join(' ').trim()
  if (!target || !typed) throw new Error(t('error.missingField', { source: 'send', field: '<site | owner/repo> "text"' }))
  const card = await resolveTarget(target)
  if (!card) throw new Error(t('send.badTarget', { target }))
  const text = compose({ text: typed, page: opts.page ?? card.page })
  const title = (opts.title ?? typed.split('\n')[0]).slice(0, 120)
  const options = ways({ card, text, title })
  if (!options.length) return out(t('send.nowhere', { target }))

  const chosen = opts.via && options.find((o) => o.via === opts.via)
  if (opts.via && !chosen) throw new Error(t('send.badVia', { via: opts.via, ways: options.filter((o) => o.via).map((o) => o.via).join(', ') }))
  if (!chosen || !opts.yes) {
    const lines = options.map((o) => `- ${o.label} (${o.needs})${o.via ? `\n  send: feedbai send ${shq(target)} ${shq(typed)} --via ${o.via}${opts.title ? ` --title ${shq(opts.title)}` : ''} --yes` : ''}\n  open: ${o.link}`)
    return out(t('send.draft', { to: card.repository ?? card.site, text, ways: lines.join('\n') }))
  }

  const state = readState()
  const { today, state: next } = countSend(state, card.repository ?? card.site)
  if (today >= DAILY_CAP) throw new Error(t('send.capped', { cap: DAILY_CAP }))
  const { config } = loadConfig({ explicit: opts.config })
  const account = (type) => config.accounts.find((a) => a.type === type && (!opts.account || a.id === opts.account))
  let sent
  if (chosen.via === 'issue') {
    const token = githubToken()
    if (!token) throw new Error(t('send.needs', { needs: 'a GitHub login (gh auth login)', link: chosen.link }))
    const repo = card.repository.replace('https://github.com/', '')
    sent = (await githubClient({ token, repo }).createIssue({ title, body: text })).html_url
  } else if (chosen.via === 'matrix') {
    if (!account('matrix')) throw new Error(t('send.needs', { needs: 'a Matrix login (feedbai login matrix)', link: chosen.link }))
    sent = await providers.matrix.post({ account: account('matrix'), room: card.matrix, text })
  } else {
    if (!account('bluesky')) throw new Error(t('send.needs', { needs: 'a Bluesky login (feedbai login bluesky)', link: chosen.link }))
    sent = await postToBluesky({ session: await session(account('bluesky')), text, target: card.bluesky })
  }
  writeState(next)
  out(t('send.sent', { url: sent }))
}
