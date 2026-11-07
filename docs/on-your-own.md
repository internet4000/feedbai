# Use feedbai on your own

feedbai doesn't need anything run by us. The hub at feedbai.internet4000.com is a convenience: it reads with its bot accounts for people who have none, and files issues for repos with its GitHub App. Everything it does, you can do with your own accounts and your own CI.

## What touches our servers, by default

| | when | how to avoid it |
| --- | --- | --- |
| Our hub's read API | a Matrix room or Bluesky search source has **no account** | log in with your own account, and set `FEEDBAI_HUB=off` |
| Our hub filing issues | you installed the feedbai GitHub App | don't install it; file from your CI (below) |
| Installing | `npm i -g @internet4000/feedbai` downloads from npm | vendor or fork it: it has no dependencies, `node src/cli.js` runs from a checkout |

Nothing else: no telemetry, no account with us. feedbai talks directly to Matrix, Bluesky and GitHub.

## Set up, step by step

**1. Make bot accounts for the project** (once). A dedicated account per platform, not your personal one:

- Matrix: register e.g. `@yourproject-bot:matrix.org` (or on your own homeserver), and invite it to your room.
- Bluesky (for searches and mentions): an account, then an [app password](https://bsky.app/settings/app-passwords).
- GitHub: nothing to create. CI has its own token; locally use `gh auth login` or a fine-grained token.

**2. Log in on your machine**, in your own terminal (it prompts for the secret and never echoes it):

```sh
feedbai login matrix --user @yourproject-bot:matrix.org
feedbai login bluesky --identifier yourproject-bot.bsky.social
```

**3. Never fall back to our hub.** Add to your shell profile:

```sh
export FEEDBAI_HUB=off
```

Check: `feedbai sources` should say `ok` (with your account) or `ok (public)` for every source, never `via the hub`.

**4. File issues from your CI.** Copy [`.github/workflows/feedbai.yml`](../.github/workflows/feedbai.yml) into your repo and add the bot's secrets under Settings → Secrets and variables → Actions:

| secret | value |
| --- | --- |
| `FEEDBAI_MATRIX_TOKEN` | the bot's access token (`feedbai login matrix` stores one in `~/.config/feedbai/secrets.env`) |
| `FEEDBAI_MATRIX_USER` | `@yourproject-bot:matrix.org` |
| `FEEDBAI_BLUESKY_IDENTIFIER`, `FEEDBAI_BLUESKY_PASSWORD` | optional: for Bluesky mentions |

Every hour it files messages that mention the bot as `feedback` issues, using the workflow's own `GITHUB_TOKEN`. Same rules as the hub ([feedback → issues](issues.md)): idempotent, private rooms only if their topic names the repo.

**5. Reply when it's fixed**: `feedbai post <message link> "Fixed in #42"` posts as your bot in the original thread.

That's the whole loop: users → your bot → your CI → issues → your agents → reply. No server.

## Or run your own hub

If several projects (or people without accounts) should share one bot, run a hub: a Cloudflare Worker or any cron job, same code. See [the hub](../hub/README.md) ("Run your own"), then point everyone at it with `FEEDBAI_HUB=https://your-hub.example`.
