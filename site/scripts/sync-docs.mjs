#!/usr/bin/env node
/** Copies the repo's docs into Starlight (src/content/docs, git-ignored). Runs before `dev` and `build`. */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { dirname } from 'node:path'
import { DOCS, toPage, pagePath } from '../docs.mjs'

const repo = new URL('../../', import.meta.url)
const out = new URL('../src/content/docs/', import.meta.url)
rmSync(out, { recursive: true, force: true })
for (const doc of DOCS) {
  const target = new URL(pagePath(doc), out)
  mkdirSync(dirname(target.pathname), { recursive: true })
  writeFileSync(target, toPage(doc, readFileSync(new URL(doc.file, repo), 'utf8')).text)
}
console.log(`synced ${DOCS.length} docs into src/content/docs`)
