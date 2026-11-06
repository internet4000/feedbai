/**
 * "Save to my Bluesky account": the Feedback button opens this page (on its own origin,
 * auth.feedbai.internet4000.com, so a bug elsewhere on the site can't reach the sign-in). The person signs in
 * with AT Protocol OAuth, allowing only one thing: creating feedbai feedback records in their own account.
 * The record is written straight to their server; feedbai stores nothing.
 */
import { BrowserOAuthClient, type OAuthSession } from '@atproto/oauth-client-browser'
import clientMetadata from '../../public/oauth/client-metadata.json'

const COLLECTION = 'com.internet4000.feedbai.feedback'
const SCOPE = clientMetadata.scope
const DRAFT = 'feedbai-draft' // survives the sign-in redirect, in this tab only
const HANDLE = 'feedbai-handle'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const store = {
  get: (key: string, where: Storage) => { try { return where.getItem(key) } catch { return null } },
  set: (key: string, value: string, where: Storage) => { try { where.setItem(key, value) } catch {} },
  drop: (key: string, where: Storage) => { try { where.removeItem(key) } catch {} },
}

const projectUri = (value = '') => {
  const m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(value.trim()) ?? /^([\w.-]+)\/([\w.-]+)$/.exec(value.trim())
  return m ? `https://github.com/${m[1]}/${m[2]}` : null
}
const pageAddress = (href = '') => {
  try {
    const url = new URL(href)
    return /^https?:$/.test(url.protocol) ? `${url.origin}${url.pathname}` : ''
  } catch {
    return ''
  }
}

type Draft = { project: string; subject: string; text: string }
const params = new URLSearchParams(location.search)
const fromLink: Draft | null = params.get('project') ? { project: params.get('project') ?? '', subject: params.get('subject') ?? '', text: params.get('text') ?? '' } : null
let draft: Draft = fromLink ?? JSON.parse(store.get(DRAFT, sessionStorage) ?? 'null') ?? { project: '', subject: '', text: '' }
draft = { project: projectUri(draft.project) ?? '', subject: pageAddress(draft.subject), text: draft.text }

const show = (state: 'form' | 'saving' | 'saved' | 'error', message = '') => {
  for (const id of ['form', 'saved']) $(id).hidden = id !== (state === 'saved' ? 'saved' : 'form')
  $('status').textContent = state === 'saving' ? 'Saving to your account…' : message
  $('status').className = state === 'error' ? 'error' : ''
}

const isLoopback = ['127.0.0.1', '[::1]'].includes(location.hostname)
const client = new BrowserOAuthClient({
  // Browsers can't look up DNS, so the handle typed here is resolved by Bluesky's public API (privacy notes say so)
  handleResolver: 'https://bsky.social',
  clientMetadata: isLoopback ? undefined : (clientMetadata as never),
})

const save = async (session: OAuthSession) => {
  show('saving')
  const record = {
    $type: COLLECTION,
    project: draft.project,
    ...(draft.subject && { subject: draft.subject }),
    text: draft.text.trim(),
    createdAt: new Date().toISOString(),
  }
  const res = await session.fetchHandler('/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ repo: session.did, collection: COLLECTION, record }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.message || body.error || `Your server answered ${res.status}`)
  store.drop(DRAFT, sessionStorage)
  ;($('record') as HTMLAnchorElement).href = `https://pdsls.dev/${body.uri}`
  show('saved')
}

const render = (session?: OAuthSession) => {
  ;($('text') as HTMLTextAreaElement).value = draft.text
  $('project').textContent = draft.project ? draft.project.replace('https://', '') : '(no project in this link)'
  $('subject-row').hidden = !draft.subject
  $('subject').textContent = draft.subject
  $('signed-in').hidden = !session
  $('signed-out').hidden = Boolean(session)
  if (session) $('who').textContent = store.get(HANDLE, localStorage) ?? session.did
  ;($('save') as HTMLButtonElement).disabled = !draft.project
  ;($('signin') as HTMLButtonElement).disabled = !draft.project
  ;($('handle') as HTMLInputElement).value = store.get(HANDLE, localStorage) ?? ''
}

const main = async () => {
  let session: OAuthSession | undefined
  let state: string | undefined
  try {
    const result = await client.init()
    session = result?.session
    state = result?.state ?? undefined
  } catch (error) {
    show('error', `Sign-in didn't complete: ${(error as Error).message}`)
  }
  render(session)

  $('text').addEventListener('input', (e) => (draft.text = (e.target as HTMLTextAreaElement).value))
  $('drop-subject').addEventListener('click', () => { draft.subject = ''; render(session) })
  $('form').addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!draft.text.trim()) return show('error', 'Write your feedback first.')
    try {
      if (session) return await save(session)
      const handle = ($('handle') as HTMLInputElement).value.trim().replace(/^@/, '')
      if (!handle) return show('error', 'Your Bluesky handle, e.g. you.bsky.social')
      store.set(HANDLE, handle, localStorage)
      store.set(DRAFT, JSON.stringify(draft), sessionStorage)
      show('saving', '')
      $('status').textContent = 'Opening your Bluesky sign-in…'
      await client.signIn(handle, { scope: SCOPE, state: 'save' })
    } catch (error) {
      show('error', (error as Error).message)
    }
  })
  $('signout').addEventListener('click', async () => {
    await session?.signOut().catch(() => {})
    session = undefined
    render()
  })
  $('close').addEventListener('click', () => window.close())

  // Back from signing in to save: save right away (they already asked to)
  if (session && state === 'save' && draft.text.trim() && draft.project) {
    try { await save(session) } catch (error) { show('error', (error as Error).message) }
  }
}

main()
