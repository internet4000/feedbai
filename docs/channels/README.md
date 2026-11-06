# Channels

A channel is a platform feedbai can read: each one is a module in [`src/providers/`](../../src/providers/).

| channel | `type` | read without an account | needs an account | filed as issues | `post` |
| --- | --- | --- | --- | --- | --- |
| [Matrix](matrix.md) | `matrix` | no | always (a bot works) | messages that mention the bot | yes |
| [Bluesky](bluesky.md) | `bluesky` | `author`, `thread` | `search`, `mentions` | `thread`, `mentions` | no |
| [GitHub Discussions](github.md) | `github` | no | always (a token) | no | no |

"Filed as issues" is what `feedbai issues` files on its own ([feedback → issues](../issues.md)). Agents still read everything and file what is actionable.

## Next channels

Slack, Microsoft Teams, Discord, Mastodon, Discourse, GitLab, a web form… A channel is one module plus its strings: see [adding a channel](adding-a-channel.md). Ask for one, or say which project would use it, in [#10](https://github.com/internet4000/feedbai/issues/10).
