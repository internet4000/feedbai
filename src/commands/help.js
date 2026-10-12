import { t } from '../i18n.js'
import { channelText, providers } from '../providers/index.js'
import { out } from './shared.js'

const names = (filter = () => true) =>
  Object.values(providers).filter(filter).map((p) => t(`channel.${p.type}.name`)).join(', ')

export const usage = () =>
  t('usage', {
    channels: names(),
    add: channelText('add') + '\n',
    login: channelText('login'),
    post: names((p) => p.post),
  })

export default () => out(usage())
