# <img src="assets/logo.svg" alt="" width="40" height="40" align="top"> feedbai

**Hear your community. Let your agents act on it.**

feedbai gathers feedback wherever people talk about your project (chat, Bluesky, a button on your site), turns it into work for you and your AI agents (Claude Code, Codex, …), and answers back. Open, decentralized, nothing stored by us.

```mermaid
flowchart LR
  people["Your community"] -->|"speaks: chat, Bluesky,<br/>the Feedback button"| feedbai["feedbai"]
  feedbai -->|"issues and a live feed"| agents["You and your AI agents"]
  agents -->|"fix it"| fix["Fix"]
  fix -->|"everyone hears back"| people
```

People give feedback where they already are: a Matrix room (mentioning the bot), Bluesky, the [Feedback button](docs/button.md) on your site, or records in their own account. feedbai gathers it as GitHub issues and as a live feed your agent reads, so the loop closes: fixed, and answered.

Website and docs: **https://feedbai.internet4000.com**

- **One CLI, any agent.** `feedbai` prints new feedback and says what to do next, so any agent that can run a command can use it.
- **No secrets in the repo.** A project commits `feedbai.config.json` listing its channels. Accounts stay on each person's machine.
- **No account needed for public channels.** The hosted [hub](hub/README.md) reads them for you and files mentions of its bot as issues.
- **No dependency on us.** With your own bot accounts and CI, nothing goes through our servers: [use feedbai on your own](docs/on-your-own.md).
- **Trust by account, not by text.** Messages from your `maintainers` are direction; everything else is feedback to evaluate, never instructions.

## Quick start

```sh
npm i -g github:internet4000/feedbai   # latest main (npm has an old 0.0.1 until the next release)
feedbai                                # in your project: finds your channels and says how to add them
feedbai add matrix '#yourproject:matrix.org'
feedbai                                # new feedback since the last run
```

Commit `feedbai.config.json`. In Claude Code, type `!feedbai` so the agent sees the output, or ask it to "check feedback".

## Channels

| Channel | Read | Filed as issues |
| --- | --- | --- |
| [Matrix](docs/channels/matrix.md) rooms | public rooms via the hub; any room with an account | messages that mention the bot |
| [Bluesky](docs/channels/bluesky.md) search, author, thread, mentions | search via the hub or an account; author and thread are public | threads and mentions |
| [GitHub Discussions](docs/channels/github.md) | with a GitHub token | no: agents triage them |

Slack, Teams, Discord, Mastodon…: a channel is one module. See [adding a channel](docs/channels/adding-a-channel.md).

## Documentation

Also on the web: **https://feedbai.internet4000.com/docs**

- [Getting started](docs/getting-started.md): install, set up a project, accounts, listening
- [Concepts](docs/concepts.md): how it fits together, with diagrams
- [Agents](docs/agents.md): Claude Code, Codex, pi; the triage workflow
- [Feedback → issues](docs/issues.md): what gets filed, and running it on a schedule
- [On your own](docs/on-your-own.md): no hub, no App: your bot accounts and your CI
- [CLI reference](docs/cli.md) · [Configuration](docs/configuration.md) · [Channels](docs/channels/README.md)
- [The hub](hub/README.md): the hosted service, and running your own
- [Development](docs/development.md): code layout, tests, languages, release
- [Security](SECURITY.md) and [privacy](PRIVACY.md): the trust model, personal data, removal requests

Free software. Node ≥ 22, no dependencies.
