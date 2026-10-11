import { readFileSync, existsSync } from 'node:fs'

const dir = new URL('./locales/', import.meta.url)
const lang = (process.env.FEEDBAI_LANG || process.env.LANG || 'en').slice(0, 2)

const load = (code) => {
  const file = new URL(`${code}.json`, dir)
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
}

const fallback = load('en')
const messages = { ...fallback, ...load(lang) }

/** Translate `key`, interpolating `{name}` placeholders from `vars`. */
export const t = (key, vars = {}) =>
  (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`)
