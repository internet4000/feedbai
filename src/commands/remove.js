import { removeSource } from '../edit.js'
import { t } from '../i18n.js'
import { out } from './shared.js'

export default ({ opts, args }) => {
  const { file } = removeSource({ id: args[0], opts })
  out(t('remove.done', { source: args[0], file }))
}
