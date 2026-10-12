# Bluesky

Four modes:

```sh
feedbai add bluesky search yourproject                     # posts matching a query
feedbai add bluesky author yourproject.com                 # an account's posts and replies
feedbai add bluesky thread https://bsky.app/profile/…/post/…   # replies in one thread
feedbai add bluesky mentions                               # mentions, replies and quotes of your account
```

| mode | source fields | account | filed as issues |
| --- | --- | --- | --- |
| `search` | `query` | via the hub, or yours | no: read for the overall mood |
| `author` | `actor` (handle or DID), optional `filter` (`posts_with_replies`, `posts_no_replies`, `posts_and_author_threads`) | not needed | no |
| `thread` | `post` (bsky.app link or AT URI), optional `depth` (default 10) | not needed | yes |
| `mentions` | none | yours (it reads that account's notifications) | yes |

## Accounts

```sh
feedbai login bluesky --identifier you.bsky.social      # an app password: https://bsky.app/settings/app-passwords
```

Use an app password, never your main one. Without an account, `search` reads through the [hub](../../hub/README.md), which searches with its own (`feedbai.bsky.social`). In CI: `FEEDBAI_BLUESKY_IDENTIFIER`, `FEEDBAI_BLUESKY_PASSWORD`.

The hub ignores `mentions` sources in repo configs: it would read its own mentions, not yours.
