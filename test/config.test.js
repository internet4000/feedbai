import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeConfigs, selectSources } from '../src/config.js'

const global = {
  accounts: [{ id: 'm', type: 'matrix', secrets: { token: 'X' } }],
  projects: [{ id: 'r4', sources: [{ id: 'a', type: 'matrix', room: '#a:x' }] }],
}
const project = {
  projects: [{ id: 'r4', name: 'Radio4000', sources: [{ id: 'a', type: 'matrix', room: '#b:x' }, { id: 'b', type: 'bluesky', mode: 'author', actor: 'x' }] }],
}

test('project config overrides and extends global config', () => {
  const merged = mergeConfigs(global, project)
  assert.equal(merged.projects.length, 1)
  assert.equal(merged.projects[0].name, 'Radio4000')
  assert.deepEqual(merged.projects[0].sources.map((s) => s.room ?? s.actor), ['#b:x', 'x'])
})

test('sources get the first account of their type and a default limit', () => {
  const [matrix, bluesky] = selectSources(mergeConfigs(global, project))
  assert.equal(matrix.account.id, 'm')
  assert.equal(matrix.source.limit, 50)
  assert.equal(bluesky.account, null)
})

test('filters and validation', () => {
  const merged = mergeConfigs(global, project)
  assert.equal(selectSources(merged, { source: 'b' }).length, 1)
  assert.throws(() => selectSources(mergeConfigs({ projects: [{ id: 'p', sources: [{ id: 's', type: 'nope' }] }] })), /Unknown source type/)
  assert.throws(() => selectSources(mergeConfigs({ projects: [{ id: 'p', sources: [{ id: 's', type: 'bluesky', mode: 'search' }] }] })), /query/)
})

test('a project config cannot bring accounts (it could send any env var to its own server)', async () => {
  const { mkdtempSync, writeFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { loadConfig } = await import('../src/config.js')
  const dir = mkdtempSync(join(tmpdir(), 'feedbai-'))
  const file = join(dir, 'feedbai.config.json')
  writeFileSync(file, JSON.stringify({
    accounts: [{ id: 'evil', type: 'matrix', homeserver: 'https://evil.example', secrets: { token: 'GH_TOKEN' } }],
    projects: [{ id: 'p', sources: [{ id: 's', type: 'matrix', room: '#r:x', account: 'evil' }] }],
  }))
  const { config } = loadConfig({ explicit: file })
  assert.equal(config.accounts.some((a) => a.id === 'evil'), false)
  assert.throws(() => selectSources(config), /evil/)
})
