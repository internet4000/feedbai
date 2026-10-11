import { readFileSync, existsSync } from 'node:fs'
import en from './locales/en.json' with { type: 'json' }

const lang = (process.env.FEEDBAI_LANG || process.env.LANG || 'en').slice(0, 2)

/** Other languages load from disk (CLI); English is bundled so runtimes without a filesystem (Workers) still have it. */
const load = (code) => {
  try {
    const file = new URL(`./locales/${code}.json`, import.meta.url)
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
  } catch {
    return {}
  }
}

const messages = { ...en, ...(lang === 'en' ? {} : load(lang)) }

/** Translate `key`, interpolating `{name}` placeholders from `vars`. */
export const t = (key, vars = {}) =>
  (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`)
