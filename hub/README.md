# feedbai hub

Runs feedbai for every project that installed the feedbai GitHub App, so projects need no bot account, no secrets and no machine of their own.

Hosted at **https://feedbai.internet4000.com** (Cloudflare Worker, every 10 minutes).

What it does per channel:

| Channel | Read with `feedbai`, no account | Filed as `feedback` issues |
| --- | --- | --- |
| Matrix room | public rooms the bot `@feedbai:matrix.org` was invited to | threads that mention the bot |
| Bluesky search | yes, with the hub's account (`feedbai.bsky.social`) | no: sentiment, read only |
| Bluesky thread, author | yes (public, no account needed anyway) | thread: yes; author: no |
| Bluesky mentions | no: they are per account, so a repo can't use the hub's | no |

New channels (GitHub Discussions, Fediverse, …) are added when a project needs one: [#10](https://github.com/internet4000/feedbai/issues/10).

**For a project**: commit `feedbai.config.json` with your channels (`npx feedbai` finds them in the repo and prints the `feedbai add …` commands), invite the bot to your Matrix room, and install the App on your repo to get issues within ~10 minutes.

**For people and agents without accounts**: the CLI reads through the hub's read API when no account of its own is configured. `GET /v1/matrix?room=#room:server[&since=ISO][&limit=n]` (public rooms only) and `GET /v1/bluesky/search?query=…` return the same items as `feedbai fetch --format json` (cached 60s). Bluesky `mentions` sources are dropped from repo configs in the hub: they would read the hub's own mentions.

**Rules** (any repo can install the App, so its config is untrusted):
- the hub always reads with its own bot account; `accounts` and `join` in a repo's config are ignored
- a repo may file a Matrix room only if the room is public, or its topic names the repo (`github.com/owner/repo`, whole name); the same rule applies to `feedbai issues` anywhere
- the bot joins rooms only when invited; kick it to stop
- GitHub access is the App's installation token: issues write + contents read, per repo

Personal data, retention and removal requests: [PRIVACY.md](../PRIVACY.md). Security model: [SECURITY.md](../SECURITY.md).

**Run your own** (free software): create a bot account and a GitHub App (Issues: read & write, Contents: read), then either enable [`.github/workflows/hub.yml`](../.github/workflows/hub.yml) in a fork (secrets `FEEDBAI_APP_ID`, `FEEDBAI_APP_PRIVATE_KEY`, `FEEDBAI_HUB_MATRIX_TOKEN`, `FEEDBAI_HUB_MATRIX_USER`; variable `FEEDBAI_HUB_ENABLED=true`), or run `node hub/run.js` from cron with the same values as `FEEDBAI_APP_ID`, `FEEDBAI_APP_PRIVATE_KEY`, `FEEDBAI_MATRIX_TOKEN`, `FEEDBAI_MATRIX_USER`. No database: GitHub issues and their hidden markers are the state.

**Cloudflare Workers** ([`worker.js`](worker.js), [`wrangler.jsonc`](../wrangler.jsonc) at the repo root; change the domain and `vars` for your own). From the repo root:

```sh
npx wrangler@4 deploy
node hub/setup.js --url https://your-hub.example --owner <github org>
npx wrangler@4 tail   # watch the next scheduled run
```

`hub/setup.js` serves a local page that creates the GitHub App (manifest flow) and logs the bot in; the App key and bot token go straight into the Worker's secrets, never to disk. Connecting the repo in Cloudflare (Workers Builds) deploys on push with the default commands.

Run only one hub per bot (Worker or the Actions workflow), not both.

**Other runtimes**: the hub is one function, `runHub({ env })` in `hub/run.js`, using only `fetch` and `node:crypto`. Call it from any scheduled handler (e.g. AWS Lambda + EventBridge).
