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

/** Who is reading: each agent (claude, codex, pi, ...) keeps its own cursors. */
export const consumerName = (opts = {}) => opts.as || process.env.FEEDBAI_AGENT || 'default'

export const stateKey = (project, source, consumer = 'default') =>
  `${consumer === 'default' ? '' : `${consumer}:`}${project.id}/${source.id}`
