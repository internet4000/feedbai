# Changelog

What changed in the `feedbai` CLI (the npm package), and in the hub and website that go with it. Newest first. Format: [Keep a Changelog](https://keepachangelog.com); versions: [semver](https://semver.org), 0.x (a minor bump can break).

## Unreleased

### Added
- `feedbai file <message link…> --title "…" --note "…"`: the agent decides what becomes an issue, and files it in feedbai's format (duplicate checks and "This is fixed" replies work on it). First step of an agent in the loop (#70).

### Added
- `feedbai react <message link> [emoji]`: a ✅ (by default) on a message, so the person sees their feedback was picked up, without a new message in the room. The skill tells agents to react when they pick up an item. Matrix for now.

### Fixed
- Bluesky: accounts remember their DID and log in with it, so a handle change (e.g. to a custom domain) no longer breaks reading. A failed login is retried next time instead of sticking, and says what to do (`feedbai login bluesky …`, or wait when Bluesky rate-limits logins). The hub's status check reuses its session instead of logging in each time.

### Security
- The shared hub bot joins **public rooms only**: it declines other invites and leaves rooms that stop being public, so its token can't expose private conversations. Private rooms: your own bot.
- The read API shares a room only when its admins made it readable without joining (history visibility "world_readable"), rate-limited per client (30 a minute), with a cache that can't be skipped by varying `since` or `limit` (#31).
- `GET /v1/status`: whether each hub secret still works; the hourly check opens an issue when one is rejected.
- Rotation: `hub/setup.js` signs out the bot's old sessions when logging it in again; SECURITY.md has the rotation table.
- Docs: SECURITY.md "The shared hub bot"; "Your project's agent" (its own account, its token never ours).
- Filing: a newline in a display name, a thread pointing at a reply, and feedback records dated in the future or flooding (#60).

## 0.2.0 — 2026-11-07

The first release on npm since 0.0.1: `npx @internet4000/feedbai`.

### Channels
- Channels are modules (`src/providers/`): core code never names a platform. [Adding one](docs/channels/adding-a-channel.md).
- **GitHub Discussions** (`feedbai add github discussions <owner/name>`).
- **AT Protocol feedback records** (`feedbai add atproto <owner/name>`): feedback people save in their own Bluesky account, read through a public index, no account needed. Record format: `lexicons/com/internet4000/feedbai/feedback.json`.
- Bluesky: searches through the hub without an account; searches and author feeds are read for sentiment, never filed as issues.
- Matrix: message edits, reply chains, and no quoted reply fallbacks.

### Commands
- `feedbai issues`: file feedback as GitHub issues, idempotently (hidden markers), from your machine or CI.
- `feedbai post`: reply in a Matrix thread or post to a source's room, marked 🤖.
- Bare `feedbai` also shows the repo's open issues and pull requests, with checks and merge state.
- Discovery finds channel links in the repo and skips placeholder rooms in docs.

### Roles and trust
- `maintainers` and `agents` in the config: direction from maintainers, bots that never open issues; known by account, never by text.
- Feedback text can't ping people, forge markers, hide instructions (invisible Unicode) or spam other repos' issues (`#12`, `owner/repo#12`, links).

### The hub (feedbai.internet4000.com)
- Files issues for every repo with the feedbai GitHub App, every 10 minutes; reads public channels for people without accounts.
- Closes the loop: once a feedback issue is fixed (closed by a pull request or commit, or labelled `fixed`), it replies once where the feedback was given. `"replies": false` turns it off.
- When it's down, the CLI says so and how to read without it; an hourly check opens an issue.

### Website and docs
- feedbai.internet4000.com: the docs (from this repo's Markdown), and the **Feedback button**: one script tag on any site, people send feedback to a Bluesky post, a GitHub issue, your chat room, or their own Bluesky account.
- [Use feedbai on your own](docs/on-your-own.md): without our hub or App.
- This changelog, and the GPL-3.0 `LICENSE` file.

## 0.1.0 — 2026-10-11

First tagged version (not published to npm): read Matrix rooms and Bluesky, `--since` cursors, digests, `watch`, the agent skill.

## 0.0.1

Placeholder on npm.
