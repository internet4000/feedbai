import matrix from './matrix.js'
import bluesky from './bluesky.js'
import github from './github.js'
import { t } from '../i18n.js'

/**
 * Registry of channel types. Add a platform by adding a module with the same shape
 * (docs/channels/adding-a-channel.md) and its `channel.<type>.*` strings in the locales.
 */
export const providers = { matrix, bluesky, github }

/** The `channel.<type>.<key>` strings of every registered channel that has one, joined. */
export const channelText = (key, vars = {}, separator = '\n') =>
  Object.keys(providers)
    .map((type) => [`channel.${type}.${key}`, type])
    .filter(([name]) => t(name) !== name)
    .map(([name]) => t(name, vars))
    .join(separator)
