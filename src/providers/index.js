import matrix from './matrix.js'
import bluesky from './bluesky.js'

/** Registry of source types. Add a platform by adding a module with the same shape. */
export const providers = { matrix, bluesky }
