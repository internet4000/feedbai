import { findProjectConfig } from '../config.js'
import { GLOBAL_CONFIG, SECRETS_FILE, STATE_FILE } from '../paths.js'
import { out } from './shared.js'

export default () =>
  out(JSON.stringify({ global: GLOBAL_CONFIG, project: findProjectConfig(), secrets: SECRETS_FILE, state: STATE_FILE }, null, 2))
