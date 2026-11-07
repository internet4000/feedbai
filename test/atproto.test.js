import { test } from 'node:test'
import assert from 'node:assert/strict'
import atproto, { projectUri, resolveDid } from '../src/providers/atproto.js'
import { fakeFetch } from './helpers.js'

const source = { id: 'records', type: 'atproto', project: 'internet4000/feedbai' }
const project = { id: 'feedbai' }
const PROJECT = 'https://github.com/internet4000/feedbai'
const didDoc = (did, handle, pds = 'https://pds.example') => ({ id: did, alsoKnownAs: [`at://${handle}`], service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: pds }] })
const record = (fields) => ({ uri: 'at://x', value: { $type: 'com.internet4000.feedbai.feedback', project: PROJECT, text: 'hello', createdAt: '2026-11-01T00:00:00Z', ...fields } })

test('a project is a full GitHub URL (Constellation only indexes URLs)', () => {
  for (const p of ['internet4000/feedbai', 'github.com/internet4000/feedbai', 'https://github.com/internet4000/feedbai/', 'https://www.github.com/internet4000/feedbai.git']) assert.equal(projectUri(p), PROJECT)
  assert.equal(projectUri('https://gitlab.com/a/b'), null)
  assert.deepEqual(atproto.add(['internet4000/feedbai']), { project: PROJECT })
  assert.throws(() => atproto.validate({ id: 'x', project: 'nope' }), /project/)
})

test('DIDs resolve to their server and handle (did:plc and did:web)', async () => {
  const fetchImpl = fakeFetch([
    [(u) => u === 'https://plc.directory/did:plc:a', didDoc('did:plc:a', 'alice.example')],
    [(u) => u === 'https://bob.example/.well-known/did.json', didDoc('did:web:bob.example', 'bob.example', 'https://bob.example')],
  ])
  assert.deepEqual(await resolveDid('did:plc:a', fetchImpl), { pds: 'https://pds.example', handle: 'alice.example' })
  assert.deepEqual(await resolveDid('did:web:bob.example', fetchImpl), { pds: 'https://bob.example', handle: 'bob.example' })
  assert.equal(await resolveDid('did:key:z', fetchImpl), null)
})

test('reads records naming the project from their authors\' servers; skips deleted, edited-away and malformed ones', async () => {
  const refs = ['ok', 'gone', 'moved', 'empty', 'baddate'].map((rkey) => ({ did: 'did:plc:a', collection: 'com.internet4000.feedbai.feedback', rkey }))
  const fetchImpl = fakeFetch([
    [(u) => u.startsWith('https://constellation.microcosm.blue/xrpc/blue.microcosm.links.getBacklinks?'), { total: 5, records: refs, cursor: null }],
    [(u) => u.startsWith('https://plc.directory/'), didDoc('did:plc:a', 'alice.example')],
    [(u) => u.includes('rkey=ok'), record({ text: 'Play is broken on Safari', subject: 'https://radio4000.com/x' })],
    [(u) => u.includes('rkey=gone'), { error: 'RecordNotFound' }, 400],
    [(u) => u.includes('rkey=moved'), record({ project: 'https://github.com/someone/else' })],
    [(u) => u.includes('rkey=empty'), record({ text: '  ' })],
    [(u) => u.includes('rkey=baddate'), record({ createdAt: 'yesterday' })],
  ])
  const items = await atproto.fetch({ project, source, limit: 50, fetchImpl })
  assert.equal(items.length, 1)
  assert.deepEqual(items[0], {
    id: 'at://did:plc:a/com.internet4000.feedbai.feedback/ok',
    platform: 'atproto',
    project: 'feedbai',
    source: 'records',
    author: { id: 'did:plc:a', name: 'alice.example' },
    text: 'Play is broken on Safari\n\nPage: https://radio4000.com/x',
    url: 'https://pdsls.dev/at://did:plc:a/com.internet4000.feedbai.feedback/ok',
    createdAt: '2026-11-01T00:00:00.000Z',
    thread: 'records:2026-11-01',
  })
  const query = new URL(fetchImpl.calls[0].url).searchParams
  assert.equal(query.get('subject'), PROJECT)
  assert.equal(query.get('source'), 'com.internet4000.feedbai.feedback:project')
})

test('a day of records is one issue: a flood of records costs one issue, the rest are comments', async () => {
  const { planIssues } = await import('../src/issues.js')
  const day = (rkey, hour) => ({ id: `at://did:plc:${rkey}/c/${rkey}`, platform: 'atproto', project: 'feedbai', source: 'records', author: { id: `did:plc:${rkey}` }, text: `spam ${rkey}`, url: 'https://x', createdAt: `2026-11-01T0${hour}:00:00.000Z`, thread: 'records:2026-11-01' })
  const actions = planIssues([day('a', 1), day('b', 2), day('c', 3)], new Map())
  assert.deepEqual(actions.map((a) => a.type), ['create'])
  assert.equal((actions[0].body.match(/feedbai:item=/g) ?? []).length, 3)
})

test('a repo files only the records naming itself', async () => {
  assert.equal(await atproto.mayFile({ source, repo: 'internet4000/feedbai' }), true)
  assert.equal(await atproto.mayFile({ source, repo: 'Internet4000/Feedbai' }), true)
  assert.equal(await atproto.mayFile({ source, repo: 'evil/repo' }), false)
  assert.equal(atproto.needsAuth(source), false)
})
