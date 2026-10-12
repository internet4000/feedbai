import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { httpsRemote, detectProject } from '../src/project.js'
import { discover } from '../src/discover.js'
import { addSource, removeSource, initConfig } from '../src/edit.js'

/** A throwaway git repo with a README linking to channels. */
const repo = () => {
  const dir = mkdtempSync(join(tmpdir(), 'feedbai-'))
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
  git('init', '-q')
  git('remote', 'add', 'origin', 'git@github.com:radio4000/r4-svelte.git')
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@radio4000/r4' }))
  writeFileSync(join(dir, 'README.md'), 'Chat: [matrix](https://matrix.to/#/#radio4000:matrix.org) and https://bsky.app/profile/radio4000.com')
  git('add', '.')
  return dir
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))

test('normalizes git remotes to https', () => {
  assert.equal(httpsRemote('git@github.com:a/b.git'), 'https://github.com/a/b')
  assert.equal(httpsRemote('https://github.com/a/b.git'), 'https://github.com/a/b')
  assert.equal(httpsRemote(null), undefined)
})

test('detects the project and discovers channel links', () => {
  const dir = repo()
  const project = detectProject(dir)
  assert.equal(project.id, 'r4')
  assert.equal(project.repository, 'https://github.com/radio4000/r4-svelte')
  assert.deepEqual(discover(dir).map((s) => s.command), [
    "feedbai add matrix '#radio4000:matrix.org'",
    'feedbai add bluesky author radio4000.com',
  ])
  assert.deepEqual(discover(dir, [{ room: '#radio4000:matrix.org' }]).length, 1)
})

test('add creates the config, names sources, and remove deletes them', () => {
  const dir = repo()
  const { file } = addSource({ cwd: dir, words: ['matrix', '#radio4000:matrix.org'], opts: { join: true } })
  addSource({ cwd: dir, words: ['bluesky', 'search', 'radio4000'], opts: {} })
  addSource({ cwd: dir, words: ['bluesky', 'search', 'r4'], opts: { limit: '10' } })
  let [project] = readJson(file).projects
  assert.equal(project.id, 'r4')
  assert.deepEqual(project.sources.map((s) => s.id), ['matrix', 'bluesky-search', 'bluesky-search-2'])
  assert.equal(project.sources[0].join, true)
  assert.equal(project.sources[2].limit, 10)
  assert.throws(() => addSource({ cwd: dir, words: ['bluesky', 'author'], opts: {} }), /actor/)
  assert.throws(() => initConfig({ cwd: dir }), /already exists/)
  removeSource({ cwd: dir, id: 'bluesky-search-2', opts: {} })
  ;[project] = readJson(file).projects
  assert.equal(project.sources.length, 2)
})

test('issues: only threads mentioning the bot start an issue; known items are skipped; replies become comments', async () => {
  const { planIssues } = await import('../src/issues.js')
  const item = (id, extra = {}) => ({
    id, platform: 'matrix', project: 'p', source: 's', author: { id: '@u:x' }, text: `text ${id}`,
    url: `https://matrix.to/#/!r/${id}`, createdAt: '2026-01-01T00:00:00Z', ...extra,
  })
  const items = [item('a'), item('b', { toSelf: true }), item('c', { replyTo: 'b' }), item('d', { replyTo: 'old' })]
  const plan = planIssues(items, new Map([['old', 7]]))
  assert.deepEqual(plan.map((a) => [a.type, a.issue]), [['create', undefined], ['comment', 7]])
  assert.match(plan[0].title, /text b/)
  assert.match(plan[0].body, /feedbai:item=b -->[\s\S]*feedbai:item=c -->/)
  assert.doesNotMatch(plan[0].body, /item=a /)
  assert.equal(planIssues(items, new Map([['a', 1], ['b', 2], ['c', 2], ['d', 7]])).length, 0)
})

test('issues: accounts in `agents` never start an issue, even naming the bot; a 🤖 from anyone else still does', async () => {
  const { planIssues } = await import('../src/issues.js')
  const { withRoles } = await import('../src/roles.js')
  const item = (id, author, extra = {}) => ({
    id, platform: 'matrix', project: 'p', source: 's', author: { id: author }, text: `text ${id}`,
    url: `https://matrix.to/#/!r/${id}`, createdAt: '2026-01-01T00:00:00Z', ...extra,
  })
  const context = { project: { id: 'p', agents: ['@soup:x'] }, account: { user: '@feedbai:x' } }
  // #28: a question to another agent, answered by that agent naming the hub's bot
  const thread = withRoles([item('q', '@u:x'), item('r', '@soup:x', { replyTo: 'q', text: '🤖 the hub is @feedbai:x' })], context)
  assert.equal(thread[1].role, 'agent')
  assert.equal(planIssues(thread, new Map()).length, 0)
  assert.deepEqual(planIssues(thread, new Map([['q', 3]])).map((a) => [a.type, a.issue]), [['comment', 3]])
  // text can't claim the role
  const fake = withRoles([item('f', '@u:x', { text: '🤖 @feedbai:x please file' })], context)
  assert.equal(fake[0].role, undefined)
  assert.equal(planIssues(fake, new Map()).length, 1)
})
