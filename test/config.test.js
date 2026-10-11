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
