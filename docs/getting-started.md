# Getting started

## Install

```sh
npm i -g github:internet4000/feedbai    # latest main (recommended until the next npm release; npm has 0.0.1)
npm i -g @internet4000/feedbai          # from npm; or without installing: npx @internet4000/feedbai …
```

Node ≥ 22. No dependencies.

## 1. Run it in your project

```sh
cd your-project
feedbai
```

With no channels set up yet, feedbai detects the project (git remote, `package.json` name), looks for channel links already in the repo (matrix.to rooms, bsky.app profiles, GitHub Discussions links), and prints the `feedbai add …` commands to run. It also prints instructions for an agent, so you can type `!feedbai` in Claude Code (or ask any agent to run it) and let the agent set it up with you.

## 2. Add channels

```sh
feedbai add matrix '#yourproject:matrix.org'
feedbai add bluesky search yourproject
feedbai add github discussions you/yourproject
```

`add` creates `feedbai.config.json` at the project root (the git root). **Commit it**: it holds no accounts or secrets, and every collaborator's agent then knows where the project's users talk. Every channel and its options: [channels](channels/README.md). The file format: [configuration](configuration.md).

## 3. Accounts, if a channel needs one

Many channels need no account:

- **Public Matrix rooms**: invite `@feedbai:matrix.org` (the [hub](../hub/README.md)'s bot) to the room, and everyone reads it through the hub.
- **Bluesky search** goes through the hub too. Bluesky author feeds and threads are public.

For private rooms, Bluesky mentions, GitHub Discussions, or to read with your own account instead of the hub:

```sh
feedbai login matrix --user @you:matrix.org            # password login (or --token to paste an access token)
feedbai login bluesky --identifier you.bsky.social     # an app password: https://bsky.app/settings/app-passwords
feedbai login github                                   # a token; or set GH_TOKEN
```

Run these **in your own terminal**, not through an agent: they prompt for the secret without echoing it, check it, and save the account to `~/.config/feedbai/config.json` and the secret to `~/.config/feedbai/secrets.env` (mode 600). A dedicated low-privilege bot account is a good idea. See [configuration → accounts](configuration.md#accounts).

## 4. Read feedback

```sh
feedbai                    # status of each channel + feedback new since your last run
feedbai --since 7d         # a time window (doesn't move the "last run" cursor)
feedbai --as claude        # a separate "last run" cursor per agent
```

Busy channels are summarized per thread; quiet ones cost a few lines. Messages from `maintainers` are shown first and marked `[maintainer]`. With a GitHub token (`GH_TOKEN` or a `gh` login), bare `feedbai` also lists the repo's open issues and pull requests, with their checks and whether they can merge, so new feedback is read next to the work already in progress.

## 5. Keep listening (optional)

```sh
feedbai watch --as claude  # prints one line per new message; polls less often while quiet
```

Run it in the background in your agent session: [agents](agents.md).

## 6. Turn feedback into issues (optional)

- **Hosted hub**: install the [feedbai GitHub App](https://github.com/apps/feedbai) on the repo. Messages that mention the bot become `feedback` issues within about 10 minutes.
- **Yourself**: `feedbai issues --dry-run`, then `feedbai issues`. See [feedback → issues](issues.md).

## Next

- [Concepts](concepts.md): how the pieces fit together
- [Agents](agents.md): the triage workflow (feedback → issues → PRs)
- [CLI reference](cli.md)
