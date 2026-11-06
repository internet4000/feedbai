# Matrix

Reads a Matrix room's messages, including edits, replies and threads.

```sh
feedbai add matrix '#yourproject:matrix.org'     # or !roomid:server, or a matrix.to link
feedbai add matrix '#yourproject:matrix.org' --join
```

| source field | |
| --- | --- |
| `room` | required: `#alias:server`, `!id:server` or a `https://matrix.to/#/…` link |
| `join` | `true`: join the room before reading (otherwise the account must have joined once) |

## Reading without an account

Matrix needs an account to read a room. Use a bot account for the project (its token also goes in CI), or your own. A self-hosted [hub](../../hub/README.md) can read public rooms for people without one (`FEEDBAI_HUB=<url>`).

## Reading with your own account

Needed for private rooms, or to read without a third party in between.

```sh
feedbai login matrix --user @yourbot:matrix.org      # password login; saves an access token
feedbai login matrix --token                         # or paste an access token (Element: Settings → Help & About)
```

Use a dedicated bot account, invite it to the room, and let it join once (or `--join`). In CI, set `FEEDBAI_MATRIX_TOKEN` and `FEEDBAI_MATRIX_USER` (and `FEEDBAI_MATRIX_HOMESERVER` if not matrix.org).

## What gets filed

A room is a conversation, not a backlog: a message starts an issue only when it **mentions the bot** (a mention pill, or `@botname` typed). Later messages in the same thread become comments on that issue. Replies that mention the bot bring the messages they reply to, so the issue makes sense on its own.

Private rooms are filed into a repo's issues only when the room's topic names the repo (`github.com/owner/repo`); public rooms always can be.

## Replying

```sh
feedbai post 'https://matrix.to/#/!room:server/$event' "Fixed in #43"   # reply in that thread
feedbai post matrix "New release is out"                                # a new message in the source's room
```

Messages are prefixed with 🤖. Add your bot to the project's `agents` so other readers know its reports are not feedback.

## Limits

- **History visibility**: rooms set to `joined` or `invited` only show messages sent after the account joined. feedbai warns when that hides feedback (`> ⚠` under the source). Join early, stay joined.
- **Encrypted rooms** are not supported. Public community rooms usually aren't encrypted.
