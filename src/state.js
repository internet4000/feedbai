import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { STATE_FILE } from './paths.js'

/** Per-source cursors, so agents can ask for "what's new since my last run". */
export const readState = (file = STATE_FILE) =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { sources: {} }

export const writeState = (state, file = STATE_FILE) => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(state, null, 2) + '\n')
}

export const stateKey = (project, source) => `${project.id}/${source.id}`
