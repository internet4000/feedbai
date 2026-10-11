import { initConfig } from '../edit.js'
import { t } from '../i18n.js'
import { out } from './shared.js'

export default ({ opts }) => out(t('init.done', { file: initConfig(opts) }))
