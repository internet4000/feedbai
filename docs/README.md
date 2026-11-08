# feedbai documentation

**Where it's going**
- [Architecture](architecture.md): one runner, the same for everyone; security first; agents per project; build order
- [Vision](vision.md): open feedback on anything over the AT Protocol, no infrastructure required, projects on auto-pilot; where we are and the steps

**Use it**
- [Getting started](getting-started.md): install, set up a project, accounts, reading and listening
- [Concepts](concepts.md): projects, channels, accounts, items, roles, cursors, the hub; with diagrams
- [Agents](agents.md): Claude Code, Codex, pi and others; the triage workflow
- [Feedback button](button.md): a button for any website; people send feedback to Bluesky, a GitHub issue or your chat room
- [Feedback → issues](issues.md): what gets filed, idempotency, scheduled runs
- [On your own](on-your-own.md): use feedbai without our hub or App: your bot accounts, your CI

**Reference**
- [CLI](cli.md): every command, option, environment variable and exit code
- [Configuration](configuration.md): `feedbai.config.json`, the global config, accounts and secrets
- [Channels](channels/README.md): [Matrix](channels/matrix.md), [Bluesky](channels/bluesky.md), [GitHub Discussions](channels/github.md), [AT Protocol records](channels/atproto.md)
- [The hub](../hub/README.md): the hosted service, its rules, and running your own

**Contribute**
- [Adding a channel](channels/adding-a-channel.md): Slack, Teams, Discord, Mastodon…
- [Development](development.md): code layout, tests, languages, release
