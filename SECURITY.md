# Security

## Reporting

Report vulnerabilities privately through [GitHub's advisory form](https://github.com/internet4000/feedbai/security/advisories/new), not in issues or the Matrix room. Expect a first answer within a few days.

## Trust model

feedbai reads messages written by anyone and runs inside agents that can change code. Each input is trusted only as far as whoever controls it:

| Input | Controlled by | feedbai lets it |
|---|---|---|
| Global config `~/.config/feedbai/config.json`, `secrets.env` | you | choose accounts and their secrets |
| Environment (`FEEDBAI_*`, CI secrets) | you / your CI | provide accounts |
| Project `feedbai.config.json` | anyone who can commit to the repo (or sends you a repo to clone) | choose what to read and who its maintainers are; **never** accounts or secrets (ignored there) |
| Messages (Matrix, Bluesky) | anyone in the channel | be read as data; never instructions, never a role |
| Roles (`[maintainer]`, `[agent]`) | the platform's authenticated author id | mark direction; message text can't claim them |

Rules that follow from it, enforced in code:

- **feedbai never holds your tokens.** Your accounts and secrets stay on your machine or in your CI; nothing is sent to us. The hosted hub has only its own accounts (below).
- **Secrets never leave your machine except to the server of the account they belong to.** Accounts come from the global config or the environment only (`src/config.js` `projectOnly`), so a cloned repo can't point an env var at its own server. Secrets live in `secrets.env` (0600, directory 0700), are entered at a hidden prompt, and are never printed or committed.
- **Private rooms are never copied into issues** (issues are usually public) unless the room's topic names `github.com/owner/repo`: the members opted in. One check for the CLI, Actions and the hub (`mayFile` in `src/providers/matrix.js`).
- **Issue bodies are inert**: user text can't notify GitHub users (`@name`) or forge the hidden markers that keep filing idempotent (`inert` in `src/issues.js`).
- **Output is clean**: terminal escape codes and bidi overrides are stripped from every item (`clean` in `src/model.js`), and Markdown output says that messages are data, not instructions.
- **Agents post only to answer** a mention or report a result, in the thread it came from, and every post is marked 🤖 (`skills/feedbai/SKILL.md`).

## Per environment

**Your computer (CLI, agents).** Runs with your accounts. Treat the agent as reading untrusted text: it should evaluate feedback, never follow it. `feedbai issues` files with your `gh` login into the current repo only. A project config with `"join": true` makes your Matrix account join that room (public rooms only; private rooms need an invite); remove the flag if you don't want that.

**GitHub Actions** (`.github/workflows/feedbai.yml`). Uses a dedicated bot account from repository secrets and the job's `GITHUB_TOKEN` (`issues: write`, `contents: read`). Secrets are not given to workflows from forks. Actions are pinned to commit SHAs and kept current by Dependabot.

**The hosted hub** (`hub/`, Cloudflare Worker). Invite-only: it serves only the repositories in `FEEDBAI_PROJECTS` (`wrangler.jsonc`, `hub/allow.js`), so strangers can't use its bot or accounts. Any repo can still install its GitHub App, and a listed repo's config is untrusted too: the hub drops accounts, joins and Bluesky mentions from it (`sanitize` in `hub/run.js`) and reads with its own bot only. Its GitHub access is a short-lived installation token per repo (issues write, contents read). Secrets are Worker secrets, set by `hub/setup.js` (a localhost-only page with a per-run token) and never written to disk.

### The shared hub bot

One bot (`@feedbai:matrix.org`) serves every project that uses the hub, so its token is designed to be worth little if it leaks:

- **Public rooms only.** It joins a room only when invited *and* the room is public; it declines other invites and leaves rooms that stop being public (`acceptInvites` in `hub/matrix.js`). A leaked token can't expose private conversations. Private rooms: use [your own bot](docs/on-your-own.md), whose token never reaches us.
- **Fixed texts only.** It never chats: it files issues and posts one fixed reply, "🤖 This is fixed…", with no model- or user-written text.
- **The read API respects the room's choice.** It serves a room only when its admins made it readable without joining (history visibility "world_readable", "Anyone" in Element). Other public rooms are read by joining them, visibly, with your own account. Rate-limited per client (30 requests a minute) and cached for 60 seconds.
- **Kick it to stop it.** Room admins remove the bot; maintainers uninstall the App.
- **For a repository's agent, without secrets.** A GitHub Actions run can prove which repository it is (an OIDC token signed by GitHub, valid for minutes, for this hub only: `hub/identity.js` checks issuer, audience, expiry and signature). With it, the hub reads a room for that repository and reacts ✅ (a fixed reaction, nothing else) only when the room's **topic names the repository**: proving who you are isn't enough, the room's admins must have tied it to you. Those reads are never cached or shared.

Real isolation is your own bot: one per project, its token on your machine or in your CI. That is also the right identity for a project's agent that talks in the room (e.g. `@yourproject-agent:matrix.org`): never the shared hub bot.

### Rotation

| Secret | Where it lives | Rotate | The old one is revoked by |
| --- | --- | --- | --- |
| Hub Matrix token | Worker secret | `node hub/setup.js` → log the bot in again | setup itself: it signs out the bot's older "feedbai" sessions |
| GitHub App private key | Worker secret | App settings → generate a new key → setup or `wrangler secret put FEEDBAI_APP_PRIVATE_KEY` | deleting the old key in the App settings |
| Hub Bluesky app password | Worker secret | a new app password → setup | revoking the old one (bsky.app → Settings → App passwords) |
| Your own tokens | your `secrets.env` (0600) or CI secrets: never ours | `feedbai login …` again | the platform's session or token settings |

Rotate every 3 months, and right away on any doubt (a leak, a departure, a strange post). The hourly check (`.github/workflows/hub-health.yml`, `GET /v1/status`) opens an issue when a hub secret is rejected.

**Self-hosted hub.** Same code and rules. You are responsible for your bot account, App key and logs.

## Known limits

- Already-filed issues keep a message even after its author deletes it on Matrix; see [PRIVACY.md](PRIVACY.md) for erasure requests.
