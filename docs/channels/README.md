# Channels

A channel is a platform feedbai can read: each one is a module in [`src/providers/`](../../src/providers/).

| channel | `type` | read without an account | needs an account | filed as issues | `post` |
| --- | --- | --- | --- | --- | --- |
| [Matrix](matrix.md) | `matrix` | public rooms the hub's bot is in | private rooms; reading with your own bot | messages that mention the bot | yes |
| [Bluesky](bluesky.md) | `bluesky` | `search` (via the hub), `author`, `thread` | `mentions`; `search` without the hub | `thread`, `mentions` | no |
| [GitHub Discussions](github.md) | `github` | no | always (a token) | no | no |

"Filed as issues" is what `feedbai issues` and the hub file on their own ([feedback → issues](../issues.md)). Agents still read everything and file what is actionable.

## Next channels

Slack, Microsoft Teams, Discord, Mastodon, Discourse, GitLab, a web form… A channel is one module plus its strings: see [adding a channel](adding-a-channel.md). Ask for one, or say which project would use it, in [#10](https://github.com/internet4000/feedbai/issues/10).
