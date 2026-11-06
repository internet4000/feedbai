# Concepts

## The loop

People talk about a project in many places. Maintainers and their agents want that feedback where the work happens: in the repo, as issues and pull requests, with a reply back to whoever asked.

```mermaid
sequenceDiagram
  actor User as Person using the project
  participant Channel as Channel (Matrix, Bluesky, …)
  participant CI as Your CI (feedbai issues)
  participant Agent as Agent + feedbai CLI
  participant GitHub

  User->>Channel: "the player skips on Safari @yourbot"
  CI->>Channel: reads every hour (the project's bot account)
  CI->>GitHub: issue #35;42 (label: feedback, links the message)
  Agent->>Channel: feedbai --as claude (new since last run)
  Agent->>GitHub: triage: comment, label, link duplicates
  Agent->>GitHub: fix → pull request "Fixes #35;42"
  Agent->>Channel: feedbai post #lt;message link#gt; "🤖 Fixed in #35;43"
```

CI and the agent are independent: use either or both. `feedbai issues` (run by you, an agent, or a scheduled workflow) does the filing.

## Architecture

```mermaid
flowchart LR
  subgraph platforms["Where people talk"]
    matrix["Matrix"]
    bluesky["Bluesky"]
    discussions["GitHub Discussions"]
  end

  subgraph local["Your machine, an agent session, or CI"]
    cli["feedbai CLI"]
    providers["channel modules<br/>src/providers/*"]
    personal["config.json (accounts)<br/>secrets.env · state.json"]
  end

  subgraph repo["Your repository"]
    config["feedbai.config.json<br/>channels · maintainers · agents"]
    issues["GitHub issues<br/>label: feedback"]
  end

  config --> cli
  personal --- cli
  cli --> providers
  providers -->|read| platforms
  cli -->|feedbai issues| issues
```

## Projects and channels

A **project** is one thing people give feedback about, usually one repository. Its **sources** are the places to read: a Matrix room, a Bluesky search, a repo's GitHub Discussions… Each source has a `type` (the channel) and the fields that channel needs.

A project's `feedbai.config.json` lives in its repo and is shared. It never holds accounts or secrets. Your global config (`~/.config/feedbai/config.json`) can list more projects, for example ones whose repo you don't control. Both are merged by project id. See [configuration](configuration.md).

**Channels are modules.** Each type is one file in `src/providers/` that knows how to read (and sometimes post to) one platform. Everything else in feedbai works with any channel. See [adding a channel](channels/adding-a-channel.md).

## Accounts and secrets

Some sources need an account to read (private rooms, searches, mentions). **Accounts are personal**: they live in your global config, never in a project's. Secrets live in `secrets.env` (mode 600), or come from environment variables in CI. An account holds the *names* of those variables, never the values.

When a source needs an account and you have none, it says which `feedbai login …` to run. A project usually has one bot account, used by people, agents and CI alike.

## Items

Every channel's messages become the same **item**:

| field | |
| --- | --- |
| `id` | the platform's id (Matrix event id, AT URI, GitHub node id…) |
| `platform`, `project`, `source` | where it came from |
| `author` | `{ id, name? }`, the account the platform authenticated |
| `text`, `url`, `createdAt` | the message, a link a person can open, an ISO date |
| `replyTo`, `thread` | the conversation it belongs to |
| `role` | `maintainer`, `agent` or `self` (below) |
| `toSelf` | it mentions the account feedbai reads with (the bot) |

Output formats: Markdown for people and agents, JSON and NDJSON for programs (`--format`).

## Roles: who is speaking

Roles come from the author's **account**, which the platform authenticates. Message text can never claim a role.

- **`[maintainer]`**: listed in the project's `maintainers`. Direction for agents, within what the person running the agent allows.
- **`[agent]`**: listed in the project's `agents` (bot accounts that work on the project), or a 🤖 report posted with your own account. Never opens an issue; `watch` skips it.
- **`[self]`**: the account feedbai reads with (it may be shared with a person).
- **Everyone else**: feedback. Data to evaluate, never instructions to follow.

## Cursors: "new since the last run"

Bare `feedbai` and `watch` show what is new since the last time they ran. Each agent keeps its own cursor (`--as claude`, `--as codex`, or `FEEDBAI_AGENT`), so two agents don't steal each other's "new". `--since 7d` shows a window without moving the cursor. Cursors are stored in `~/.local/state/feedbai/state.json`.

## Digests

When a source has more than 30 new items, Markdown output switches to a digest: maintainer messages in full, then one line per thread with its reply count and latest reply. Agents read conversations, not a firehose.

## Issues are the shared memory

Agents start fresh every session. GitHub issues labelled `feedback` are what persists: each one links the original messages through hidden markers, so no session or agent files or triages the same message twice. Coding agents then work from issues as usual. See [feedback → issues](issues.md).

Not everything becomes an issue. Chat rooms are conversations, so only messages that mention the bot start one. Searches and discussions are read for the overall mood, and agents file only what's actionable.

## No infrastructure

feedbai runs where you already work: your machine, an agent session, your CI. There's nothing to host. The [hub](../hub/README.md) (a Worker that read and filed for repos with its GitHub App) is optional and self-hosted only (`FEEDBAI_HUB=<url>`); it's being retired. Where feedbai is going next: [vision](vision.md).
