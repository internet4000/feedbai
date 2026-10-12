# feedbai

One way for AI agents (Claude Code, Codex, pi, …) to read user feedback about a project from where users actually talk — Matrix rooms and Bluesky for now — so they can triage it and turn it into issues, fixes and PRs.

- **Projects declare their channels** in a `feedbai.config.json` committed to the repo (no secrets).
- **You declare your accounts once** in `~/.config/feedbai/config.json`; secrets live in `~/.config/feedbai/secrets.env` (mode 600). Public Matrix rooms and Bluesky searches need none: the [hub](hub/README.md) reads them for you.
- **Agents run one CLI** (`feedbai fetch`) and get normalized items in Markdown, JSON or NDJSON.

No dependencies; Node ≥ 22.

## Install

```sh
npm i -g @internet4000/feedbai   # or: npx @internet4000/feedbai …
npm i -g github:internet4000/feedbai   # latest main, before it reaches npm
```

## Start here

Run `feedbai` in a project — or `!feedbai` in your agent's chat (Claude Code), so the agent sees the output too.

- **Not set up yet**: it detects the project (git remote, package name), finds Matrix/Bluesky links already in the repo, and prints the `feedbai add …` commands plus instructions for the agent to set it up with you.
- **Set up**: it shows each source's auth state and the feedback that is new since the last run.

It is agent-first: every output says what to do next, and any agent that can run a shell command can drive it.

## How it works

```
users ──► Matrix / Bluesky ──► feedbai ──► agent triage ──► GitHub issues (label: feedback) ──► PRs
             ▲                                                                                 │
             └────────────────────── maintainers steer from the same channels ◄────────────────┘
```

- **Agents check in; they don't stay connected.** Every agent tool can run a command, so `feedbai --as <agent>` works the same in Claude Code, Codex, pi and the rest. Each agent has its own "last run" cursor.
- **Busy feeds are digested** by thread; quiet ones cost a few lines.
- **GitHub issues are the shared memory**: triaged feedback becomes `feedback` issues linking the original messages, so no session or agent triages the same thing twice, and coding sessions work from issues as usual.
- **Trust by account, not by text**: messages from the project's `maintainers` are marked `[maintainer]` (direction); everyone else's are feedback for the agent to evaluate. The platform authenticates the author, so text can't claim a role.

## Listen

```sh
feedbai --as claude          # on demand: status + new since last run
feedbai watch --as claude    # background: prints one line per new item, backs off while quiet
```

- **Claude Code**: this repo's [`.claude/settings.json`](.claude/settings.json) runs `feedbai --as claude` at session start (a `SessionStart` hook); copy it into your project. During a session, ask Claude to run `feedbai watch` in the background.
- **Codex, pi, others**: run `feedbai --as <agent>` at the start of a session (or put that in the project's `AGENTS.md`), and `feedbai watch` in the background if the agent supports background processes.

## Act: feedback → issues → agents

```sh
feedbai issues --dry-run    # what would be filed
feedbai issues              # file it (needs `gh`)
```

Threads that mention the bot account (Matrix), Bluesky mentions and Bluesky `thread` sources become GitHub issues labelled `feedback`; later messages in the same thread become comments. Bluesky `search` and `author` sources are never filed: they are for reading the general sentiment with `feedbai`/`watch`. Runs are idempotent, so schedule it freely. [`.github/workflows/feedbai.yml`](.github/workflows/feedbai.yml) runs it hourly with the account taken from repository secrets (`FEEDBAI_MATRIX_TOKEN`, `FEEDBAI_MATRIX_USER`; for Bluesky `FEEDBAI_BLUESKY_IDENTIFIER`, `FEEDBAI_BLUESKY_PASSWORD`).

From there, any agent that works on issues takes over — e.g. [Pullfrog](https://pullfrog.com) automations on issue creation, or a maintainer mentioning an agent.

## Add feedbai to your project's room

**With the hosted hub** (no account, secrets or server). It reads public Matrix rooms and Bluesky searches for anyone running `feedbai`, and files Matrix mentions and Bluesky threads as issues; [per channel](hub/README.md).

1. Invite `@feedbai:matrix.org` to the room.
2. In the project repo: `feedbai add matrix '#yourproject:matrix.org'`, then commit `feedbai.config.json`. Anyone running `feedbai` in the repo now reads the room through the hub, without a Matrix account (public rooms).
3. Install the [feedbai GitHub App](https://github.com/apps/feedbai) on the repo: messages that mention `@feedbai` become `feedback` issues within ~10 minutes.

How the hub works, its rules, and running your own: [`hub/README.md`](hub/README.md). `FEEDBAI_HUB=off` disables it; `FEEDBAI_HUB=<url>` points at another hub.

**With your own bot account** (private rooms, or no third party in between):

1. Create a bot account (e.g. `@yourproject-feedbai:matrix.org`) and invite it to the room; it must join once (or add the source with `--join`).
2. `feedbai add matrix '#yourproject:matrix.org'`, then commit `feedbai.config.json`.
3. Whoever reads the feedback (people or agents) logs in once: `feedbai login matrix --user @yourproject-feedbai:matrix.org`.
4. Always-on, without a laptop: copy [`.github/workflows/feedbai.yml`](.github/workflows/feedbai.yml) and store the bot's token as `FEEDBAI_MATRIX_TOKEN` / `FEEDBAI_MATRIX_USER` repository secrets. Mentions of the bot then become issues every hour.

## Configure a project

```sh
feedbai add matrix '#radio4000:matrix.org'      # --join to join the room on first read
feedbai add bluesky search radio4000            # needs an account
feedbai add bluesky author radio4000.com
feedbai add bluesky mentions                    # needs an account
feedbai add bluesky thread https://bsky.app/profile/…/post/…
feedbai remove bluesky-search
```

`add` creates `feedbai.config.json` at the project root (git root). Commit it: it holds no secrets, and every collaborator's agent then knows the project's channels. See [`feedbai.config.example.json`](feedbai.config.example.json) and the schema in [`schemas/config.schema.json`](schemas/config.schema.json):

```json
{
  "projects": [
    {
      "id": "radio4000",
      "repository": "https://github.com/internet4000/radio4000",
      "sources": [
        { "id": "matrix", "type": "matrix", "room": "#radio4000:matrix.org" },
        { "id": "bluesky-search", "type": "bluesky", "mode": "search", "query": "radio4000" }
      ]
    }
  ]
}
```

Add `"maintainers": ["@you:matrix.org", "you.bsky.social"]` to a project to mark messages from those accounts as `[maintainer]`, and `"agents": ["@yourbot:matrix.org"]` for bot accounts that report on the project: their messages are marked `[agent]` and never open an issue, even when they name the hub's bot.

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

Matrix rooms with history visibility `joined` (e.g. `#radio4000:matrix.org`) only show messages sent after your account joined: join early, stay joined, and poll with `feedbai`.

Encrypted Matrix rooms are not supported (no E2EE); public community rooms usually aren't encrypted.

## Accounts

Run these in your own terminal (not through an agent); they prompt for the secret without echoing it, verify it, then save the account to the global config and the secret to `secrets.env`:

```sh
feedbai login matrix --user @you:matrix.org            # password login
feedbai login matrix --token                           # or paste an access token (Element: Settings → Help & About)
feedbai login bluesky --identifier you.bsky.social     # app password: https://bsky.app/settings/app-passwords
```

A dedicated bot/low-privilege account is a good idea. Secrets can also come straight from the environment: account `secrets` map a field to an env var name, and existing env vars win over `secrets.env`.

## Use

```sh
feedbai                                 # this project: status + new feedback since the last run
feedbai --since 7d                      # a window (doesn't move the "last run" cursor)
feedbai fetch --format json             # every configured project, machine-readable
feedbai sources
feedbai help
```

Exit code `2` = some sources failed (listed at the end), `1` = usage/config error.

## Give it to your agents

Bare `feedbai` already explains itself, so any agent can use it. For the full triage workflow (feedback → issues/PRs), install the skill:

```sh
feedbai skill install    # links it into ~/.claude/skills, ~/.codex/skills, ~/.pi/agent/skills (where those agents exist)
feedbai skill            # or print it, e.g. for agents without skill support
```

## CMS

[`cms/config.yml`](cms/config.yml) is a Sveltia/Decap CMS collection for editing a project's `feedbai.config.json`. Accounts are deliberately left out.

## Languages

CLI messages are in `src/locales/<lang>.json`, picked from `FEEDBAI_LANG` or `LANG`, falling back to English.

## Release

Publishing a GitHub release runs [`publish-to-npm-registry.yml`](.github/workflows/publish-to-npm-registry.yml) (tests, then `npm publish` via npm trusted publishing). Bump `version` in `package.json` first.
