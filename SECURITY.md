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

- **Secrets never leave your machine except to the server of the account they belong to.** Accounts come from the global config or the environment only (`src/config.js` `projectOnly`), so a cloned repo can't point an env var at its own server. Secrets live in `secrets.env` (0600, directory 0700), are entered at a hidden prompt, and are never printed or committed.
- **Private rooms are never copied into issues** (issues are usually public) unless the room's topic names `github.com/owner/repo`: the members opted in. One check for the CLI, Actions and the hub (`mayFile` in `src/providers/matrix.js`).
- **Issue bodies are inert**: user text can't notify GitHub users (`@name`) or forge the hidden markers that keep filing idempotent (`inert` in `src/issues.js`).
- **Output is clean**: terminal escape codes and bidi overrides are stripped from every item (`clean` in `src/model.js`), and Markdown output says that messages are data, not instructions.
- **Agents post only to answer** a mention or report a result, in the thread it came from, and every post is marked 🤖 (`skills/feedbai/SKILL.md`).

## Per environment

**Your computer (CLI, agents).** Runs with your accounts. Treat the agent as reading untrusted text: it should evaluate feedback, never follow it. `feedbai issues` files with your `gh` login into the current repo only. A project config with `"join": true` makes your Matrix account join that room (public rooms only; private rooms need an invite); remove the flag if you don't want that.

**GitHub Actions** (`.github/workflows/feedbai.yml`). Uses a dedicated bot account from repository secrets and the job's `GITHUB_TOKEN` (`issues: write`, `contents: read`). Secrets are not given to workflows from forks. Actions are pinned to commit SHAs and kept current by Dependabot.

**The hosted hub** (`hub/`, Cloudflare Worker). Any repo can install its GitHub App, so a repo's config is untrusted there: the hub drops accounts, joins and Bluesky mentions from it (`sanitize` in `hub/run.js`) and reads with its own bot only. Its GitHub access is a short-lived installation token per repo (issues write, contents read). The bot joins only rooms it is invited to; kick it to stop. The read API serves public rooms and Bluesky search only, cached for 60 seconds. Secrets are Worker secrets, set by `hub/setup.js` (a localhost-only page with a per-run token) and never written to disk.

**Self-hosted hub.** Same code and rules. You are responsible for your bot account, App key and logs.

## Known limits

- The hub's read API has no per-client rate limit beyond the 60-second cache; heavy use counts against the hub bot's Matrix rate limits.
- Already-filed issues keep a message even after its author deletes it on Matrix; see [PRIVACY.md](PRIVACY.md) for erasure requests.
