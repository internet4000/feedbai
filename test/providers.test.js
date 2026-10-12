import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { providers } from '../src/providers/index.js'
import { t } from '../src/i18n.js'

const schema = JSON.parse(readFileSync(new URL('../schemas/config.schema.json', import.meta.url), 'utf8'))
const cms = readFileSync(new URL('../cms/config.yml', import.meta.url), 'utf8')

// The contract every channel module meets (docs/channels/adding-a-channel.md): adding one is
// one file, one line in providers/index.js, its strings, schema and CMS entries — checked here.
for (const [type, provider] of Object.entries(providers)) {
  test(`channel "${type}" meets the provider contract`, () => {
    assert.equal(provider.type, type)
    for (const fn of ['validate', 'describe', 'add', 'needsAuth', 'authStatus', 'fetch']) assert.equal(typeof provider[fn], 'function', `${type}.${fn}`)
    for (const key of ['name', 'add', 'setup', 'hint']) assert.notEqual(t(`channel.${type}.${key}`), `channel.${type}.${key}`, `locale channel.${type}.${key}`)
    if (provider.authenticate) assert.notEqual(t(`channel.${type}.login`), `channel.${type}.login`)
    for (const { regex, suggest } of provider.discover ?? []) assert.ok(typeof regex === 'string' && typeof suggest === 'function')
    if (provider.filing) assert.ok(['mentions', 'all'].includes(provider.filing))
    assert.ok(schema.$defs.source.properties.type.enum.includes(type), 'schema source type')
    assert.ok(schema.$defs.source.oneOf.some((o) => o.properties.type.const === type), 'schema source fields')
    assert.match(cms, new RegExp(`- name: ${type}\\n`), 'cms type')
  })
}
