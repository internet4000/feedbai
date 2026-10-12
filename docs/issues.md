# Feedback → issues

Issues labelled `feedback` are where feedback is remembered: each links the original messages, and later messages in the same thread are added as comments.

## What gets filed

| channel | starts an issue | added as a comment |
| --- | --- | --- |
| Matrix | a message that mentions the bot | any later message in the same thread |
| Bluesky `thread`, `mentions` | any message | later messages in the same thread |
| Bluesky `search`, `author` | never (read them for the overall mood) | — |
| GitHub Discussions | never (agents file what's actionable) | — |

Never, on any channel:

- **`[agent]` messages** (accounts listed in `agents`, or your own 🤖 reports) don't start an issue, even when they name the bot. They're still added as comments to an issue that already exists.
- **Private Matrix rooms** go into a repo's issues only if the room's topic names that repo.

Each issue quotes the messages with author, date and link. Text is made inert: `@names` don't ping GitHub users, and HTML comments can't hide text.

## Idempotent

Every quoted message carries a hidden marker (`<!-- feedbai:item=… -->`). Before filing, feedbai reads the repo's `feedback` issues and comments, so a message is never filed twice. Overlapping runs are safe: schedule it as often as you like.

## Ways to run it

**The hosted hub** (nothing to run): install the [feedbai GitHub App](https://github.com/apps/feedbai) on the repo, and commit `feedbai.config.json`. Every 10 minutes the hub files from the channels it can read (public Matrix rooms its bot is in, Bluesky threads), using its own accounts. See [the hub](../hub/README.md).

**By hand or from an agent**:

```sh
feedbai issues --dry-run     # what would be filed
feedbai issues               # file it; default window --since 1d
```

It needs a GitHub token (`GH_TOKEN`, `GITHUB_TOKEN`, or a `gh` login) and the repo (`GH_REPO`, `GITHUB_REPOSITORY`, or the git remote).

**GitHub Actions, with your own bot**: copy [`.github/workflows/feedbai.yml`](../.github/workflows/feedbai.yml) (hourly, `feedbai issues --since 2h`) and add the bot's secrets to the repository: `FEEDBAI_MATRIX_TOKEN`, `FEEDBAI_MATRIX_USER`. For Bluesky `mentions`, also pass `FEEDBAI_BLUESKY_IDENTIFIER` and `FEEDBAI_BLUESKY_PASSWORD` in the workflow's `env`. Without a Matrix token the workflow skips, so it doesn't run alongside the hub.
