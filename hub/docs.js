/**
 * The repo's docs, bundled into the Worker as text (wrangler.jsonc: `rules`, *.md as Text).
 * Keyed by repo path; hub/site.js says where each one is served. test/site.test.js checks the two agree.
 */
import index from '../docs/README.md'
import gettingStarted from '../docs/getting-started.md'
import concepts from '../docs/concepts.md'
import agents from '../docs/agents.md'
import issues from '../docs/issues.md'
import onYourOwn from '../docs/on-your-own.md'
import cli from '../docs/cli.md'
import configuration from '../docs/configuration.md'
import channels from '../docs/channels/README.md'
import matrix from '../docs/channels/matrix.md'
import bluesky from '../docs/channels/bluesky.md'
import github from '../docs/channels/github.md'
import addingAChannel from '../docs/channels/adding-a-channel.md'
import hub from './README.md'
import vision from '../docs/vision.md'
import development from '../docs/development.md'
import privacy from '../PRIVACY.md'
import security from '../SECURITY.md'

export const docs = {
  'docs/README.md': index,
  'docs/getting-started.md': gettingStarted,
  'docs/concepts.md': concepts,
  'docs/agents.md': agents,
  'docs/issues.md': issues,
  'docs/on-your-own.md': onYourOwn,
  'docs/cli.md': cli,
  'docs/configuration.md': configuration,
  'docs/channels/README.md': channels,
  'docs/channels/matrix.md': matrix,
  'docs/channels/bluesky.md': bluesky,
  'docs/channels/github.md': github,
  'docs/channels/adding-a-channel.md': addingAChannel,
  'hub/README.md': hub,
  'docs/vision.md': vision,
  'docs/development.md': development,
  'PRIVACY.md': privacy,
  'SECURITY.md': security,
}
