import { installSkill, readSkill } from '../skill.js'
import { t } from '../i18n.js'
import { out } from './shared.js'

export default ({ args }) => {
  if (args[0] !== 'install') return out(readSkill())
  const results = installSkill()
  if (!results.length) return out(t('skill.noAgents'))
  out(results.map((r) => t(r.skipped ? 'skill.skipped' : 'skill.linked', r)).join('\n'))
}
