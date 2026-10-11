import { homedir } from 'node:os'
import { join } from 'node:path'

const env = process.env

export const CONFIG_DIR = join(env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'feedbai')
export const STATE_DIR = join(env.XDG_STATE_HOME || join(homedir(), '.local', 'state'), 'feedbai')

export const PROJECT_CONFIG_NAME = 'feedbai.config.json'
export const GLOBAL_CONFIG = env.FEEDBAI_CONFIG || join(CONFIG_DIR, 'config.json')
export const SECRETS_FILE = env.FEEDBAI_SECRETS || join(CONFIG_DIR, 'secrets.env')
export const STATE_FILE = join(STATE_DIR, 'state.json')
