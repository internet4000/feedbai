import { addSource } from '../edit.js'
import { loadConfig, selectSources } from '../config.js'
import { t } from '../i18n.js'
import { authState, out } from './shared.js'

export default ({ opts, args }) => {
  const { file, project, source } = addSource({ words: args, opts })
  const [entry] = selectSources(loadConfig().config, { project: project.id, source: source.id })
  const lines = [t('add.done', { source: source.id, file })]
  if (['login', 'missing'].includes(authState(entry))) lines.push(t('add.needsLogin', { command: t(`channel.${source.type}.hint`) }))
  lines.push(t('add.next'))
  out(lines.join('\n'))
}
