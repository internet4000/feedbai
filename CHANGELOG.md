# Changelog

What changed in the `feedbai` CLI (the npm package), and in the hub and website that go with it. Newest first. Format: [Keep a Changelog](https://keepachangelog.com); versions: [semver](https://semver.org), 0.x (a minor bump can break).

## Unreleased

## 0.5.0 — 2026-11-09

Hear your community, act on it: a plainer home page, a Feedback button that works on any site and matches it, and agents that give feedback to other projects.

### Changed
- **Hear your community. Act on it.** The home page is plain and short: one card that says what feedbai does for everyone, the projects listening now, three steps to set one up. Agents are one way to act on feedback, not the pitch.

### Fixed
- **The Feedback button loads on other sites:** `embed.js` is now sent with CORS headers; browsers refused it as a module script from another origin, so it only worked on our own site.

### Added
- **Load the button from jsDelivr or unpkg**, a fixed version with its hash (`integrity`): `embed.js` is in the npm package.
- **Style the Feedback button to match your site:** its colours are CSS variables you set on the element (`--accent`, `--bg`, `--ink`…, light and dark), it can use your page's font, and its parts are named for `::part()` (`button`, `dialog`, `card`, `textarea`, `primary`, `place`). Docs: Feedback button → Make it yours.
- **The loop, live, on the home page:** projects that opt in (`"listed": true` in their public `feedbai.config.json`, with the GitHub App) show where they listen and how many feedback issues were filed and fixed in the last 30 days, with the hub's health. Numbers and links only, never what people wrote; nothing stored (`GET /v1/ecosystem`, read from GitHub, cached 10 minutes).
- `feedbai send <site | owner/repo> "…"`: give feedback to another project, from your own accounts. Reads its `/.well-known/feedbai.json` or `feedbai.config.json`, shows the draft and the ways it listens (GitHub issue, Matrix, Bluesky post, contact links), and sends only with `--via … --yes`. Marked 🤖, 5 per project per day. The skill tells agents to propose it, never to send without a yes (#53). Our site publishes `/.well-known/feedbai.json`.

## 0.4.0 — 2026-11-08

An agent in the loop: each project's own agent triages its feedback, with no secrets to create.

### Changed
- **The Feedback button is a guided dialog:** what's on your mind → how do you want to send it (each place says what account it needs, last time's first, and "no account?" helps) → done, you'll hear back there. Native dialog (focus, Escape, screen readers), bottom sheet on phones. "Keep it in my Bluesky account" is now opt-in (`data-records`).
- **The home page is shorter:** the pitch, the loop, three steps, three questions.

### Added
- **No secrets for a project's agent in GitHub Actions:** the read and act jobs prove to the hub which repository they are (OIDC, `id-token: write`), and the hub's bot reads the room and adds ✅ for them, in rooms whose topic names the repository. `.github/workflows/feedbai-agent.yml` needs no secrets anymore.
- `feedbai triage`: a model proposes what to file and ✅ (no tools, no secrets, checked plan), plain code acts (`--apply`). Any OpenAI-compatible model (OpenRouter, local, a provider); without one, nothing is filed. Follows the project's `.feedbai/guidelines.md` (#63).
- `.github/workflows/feedbai-agent.yml`: the agent in the loop every hour, in three jobs with different powers (read / triage / act).
- `"filing": "agent"` in a project's config: the hub stops copying mentions into issues, the project's agent triages (#70).

## 0.3.0 — 2026-11-08

The first release shaped by a real user's first try (thanks oskar).

### Added
- **Guided setup with an agent**: in a project that isn't set up, bare `feedbai` tells the agent to say what feedbai does, ask which setup you want (read in agent sessions / also turn chat mentions into issues with the hub / also a website button), do the config itself, and end with your own steps, numbered 1-2-3.
- `feedbai file <message link…> --title "…" --note "…"`: the agent decides what becomes an issue, and files it in feedbai's format (duplicate checks and "This is fixed" replies work on it). First step of an agent in the loop (#70).
- `feedbai react <message link> [emoji]`: a ✅ (by default) on a message, so the person sees their feedback was picked up, without a new message in the room. The skill tells agents to react when they pick up an item. Matrix for now.

### Fixed
- The shared bot says why when it declines a private room ("feedbai rejected the invite: …"), instead of silently.
- The digest lists a maintainer's message once, not twice.
- `feedbai watch` stops polling a source whose login was refused, and pauses a rate-limited one for 15 minutes, instead of retrying every minute (which got the account locked, for the hub too when it shares it).
- Bluesky: accounts remember their DID and log in with it, so a handle change (e.g. to a custom domain) no longer breaks reading. A failed login is retried next time instead of sticking, and says what to do (`feedbai login bluesky …`, or wait when Bluesky rate-limits logins). The hub's status check reuses its session instead of logging in each time.

### Changed
- One parser for GitHub repository and page addresses (`src/links.js`), shared by the CLI, the providers and the sign-in page; the Feedback button keeps its own copy (one self-hostable file), checked against it. The button now also accepts `www.github.com` links.
- Removed the unused CMS collection (`cms/`) and the always-skipped hub Actions workflow (`hub.yml`): the hub runs as the Worker, or `node hub/run.js` from any cron.
- CI runs on pull requests (forks too) and on Node 22, the oldest supported, as well as the current LTS.

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
