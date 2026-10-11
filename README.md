# feedbai

One way for AI agents (Claude Code, Codex, pi, …) to read user feedback about a project from where users actually talk — Matrix rooms and Bluesky for now — so they can triage it and turn it into issues, fixes and PRs.

- **Projects declare their channels** in a `feedbai.config.json` committed to the repo (no secrets).
- **You declare your accounts once** in `~/.config/feedbai/config.json`; secrets live in `~/.config/feedbai/secrets.env` (mode 600).
- **Agents run one CLI** (`feedbai fetch`) and get normalized items in Markdown, JSON or NDJSON.

No dependencies; Node ≥ 22.

## Install

```sh
git clone <this repo> && cd feedbai && npm link   # puts `feedbai` on your PATH
```

## Configure a project

`feedbai.config.json` at the root of the project repository (see [`feedbai.config.example.json`](feedbai.config.example.json), schema in [`schemas/config.schema.json`](schemas/config.schema.json)):

```json
{
  "projects": [
    {
      "id": "radio4000",
      "repository": "https://github.com/internet4000/radio4000",
      "sources": [
        { "id": "matrix", "type": "matrix", "room": "https://matrix.to/#/#radio4000:matrix.org" },
        { "id": "bsky-search", "type": "bluesky", "mode": "search", "query": "radio4000" },
        { "id": "bsky-mentions", "type": "bluesky", "mode": "mentions" }
      ]
    }
  ]
}
```

The global config uses the same shape, so you can also list projects there (e.g. projects whose repo you don't control). Project and global configs are merged by `id`.

### Source types

| type | mode | needs | account |
|---|---|---|---|
| `matrix` | — | `room`: `#alias:server`, `!id:server` or matrix.to link | required |
| `bluesky` | `search` | `query` | required |
| `bluesky` | `mentions` | — (mentions, replies and quotes of your account) | required |
| `bluesky` | `author` | `actor` (handle/DID) | optional |
| `bluesky` | `thread` | `post` (bsky.app link or AT URI) | optional |

Optional on every source: `limit` (default 50), `account` (account id; defaults to the first account of that type). Matrix: `join: true` to join the room before reading — otherwise join it once yourself.

Encrypted Matrix rooms are not supported (no E2EE); public community rooms usually aren't encrypted.

## Accounts

Run these yourself; they prompt for the secret without echoing it, verify it, then save the account to the global config and the secret to `secrets.env`:

```sh
feedbai login matrix --user @you:matrix.org            # password login
feedbai login matrix --token                           # or paste an access token (Element: Settings → Help & About)
feedbai login bluesky --identifier you.bsky.social     # app password: https://bsky.app/settings/app-passwords
```

A dedicated bot/low-privilege account is a good idea. Secrets can also come straight from the environment: account `secrets` map a field to an env var name, and existing env vars win over `secrets.env`.

## Use

```sh
feedbai sources
feedbai fetch --since last              # new since the previous `--since last` run (cursor per source)
feedbai fetch --since 7d --format json
feedbai paths                           # where config, secrets and state live
```

Exit code `2` = some sources failed (listed at the end), `1` = usage/config error.

## Give it to your agents

The agent instructions are a standard skill: [`skills/feedbai/SKILL.md`](skills/feedbai/SKILL.md). Link it where your agent looks for skills, e.g.:

```sh
ln -s "$PWD/skills/feedbai" ~/.claude/skills/feedbai      # Claude Code
ln -s "$PWD/skills/feedbai" ~/.codex/skills/feedbai       # Codex
ln -s "$PWD/skills/feedbai" ~/.pi/agent/skills/feedbai    # pi
```

For agents without skill support, add to the project's `AGENTS.md`: *"User feedback: run `feedbai fetch --since last`; follow `<path>/skills/feedbai/SKILL.md`."*

## CMS

[`cms/config.yml`](cms/config.yml) is a Sveltia/Decap CMS collection for editing a project's `feedbai.config.json`. Accounts are deliberately left out.

## Languages

CLI messages are in `src/locales/<lang>.json`, picked from `FEEDBAI_LANG` or `LANG`, falling back to English.
