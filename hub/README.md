# feedbai hub

Runs feedbai for every project that installed the feedbai GitHub App, so projects need no bot account, no secrets and no machine of their own.

Hosted at **https://feedbai.internet4000.com** (Cloudflare Worker, every 10 minutes).

The hub is a convenience, not a requirement: it keeps no data that matters, anyone can run one (or do without: [on your own](../docs/on-your-own.md)), and when it's down the CLI says so and shows how to read with your own account (`feedbai login …`), or file from your CI ([feedback → issues](../docs/issues.md)). An hourly check in [`.github/workflows/hub-health.yml`](../.github/workflows/hub-health.yml) opens an issue "feedbai hub is down" when it stops answering, and closes it when it's back.

What it does per channel:

| Channel | Read with `feedbai`, no account | Filed as `feedback` issues |
| --- | --- | --- |
| Matrix room | public rooms the bot `@feedbai:matrix.org` was invited to, whose history anyone may read ("world_readable") | threads that mention the bot, in public rooms |
| Bluesky search | yes, with the hub's account (`feedbai.internet4000.com`) | no: sentiment, read only |
| Bluesky thread, author | yes (public, no account needed anyway) | thread: yes; author: no |
| Bluesky mentions | no: they are per account, so a repo can't use the hub's | no |

New channels (GitHub Discussions, Fediverse, …) are added when a project needs one: [#10](https://github.com/internet4000/feedbai/issues/10).

**For a project**: commit `feedbai.config.json` with your channels (`npx @internet4000/feedbai` finds them in the repo and prints the `feedbai add …` commands), invite the bot to your Matrix room, and install the App on your repo to get issues within ~10 minutes.

**For people and agents without accounts**: the CLI reads through the hub's read API when no account of its own is configured. `GET /v1/matrix?room=#room:server[&since=ISO][&limit=n]` (only rooms readable without joining: "world_readable") and `GET /v1/bluesky/search?query=…` return the same items as `feedbai fetch --format json` (cached 60s). Bluesky `mentions` sources are dropped from repo configs in the hub: they would read the hub's own mentions.

**Rules** (any repo can install the App, so its config is untrusted):
- the hub always reads with its own bot account; `accounts` and `join` in a repo's config are ignored
- the bot joins **public rooms only**: it declines invites to others and leaves rooms that stop being public, so its shared token can't expose private conversations. Private rooms: your own bot ([on your own](../docs/on-your-own.md)); with it, a private room is filed only if its topic names the repo (`github.com/owner/repo`)
- the read API is rate-limited per client (30 a minute) and only serves rooms readable without joining, or, to a GitHub Actions run proving its repository (OIDC), the rooms whose topic names that repository; `POST /v1/matrix/react` adds ✅ for it there (a project's agent, with no secrets: [an agent in the loop](../docs/issues.md#an-agent-in-the-loop-feedbai-triage))
- `GET /v1/status` says whether each hub secret still works; the hourly check opens an issue when one is rejected. Rotation: [SECURITY.md](../SECURITY.md#rotation)
- the bot joins rooms only when invited; kick it to stop
- GitHub access is the App's installation token: issues write + contents read, per repo
- when a feedback issue is fixed (closed by a pull request or commit, or labelled `fixed`), the bot replies "🤖 This is fixed" with its link, once, in the thread it came from ([closing the loop](../docs/issues.md#closing-the-loop); `"replies": false` in the config stops it)

Personal data, retention and removal requests: [PRIVACY.md](../PRIVACY.md). Security model: [SECURITY.md](../SECURITY.md).

**Run your own** (free software): create a bot account and a GitHub App (Issues: read & write, Contents: read), then deploy the Cloudflare Worker (below), or run `node hub/run.js` from any cron with `FEEDBAI_APP_ID`, `FEEDBAI_APP_PRIVATE_KEY`, `FEEDBAI_MATRIX_TOKEN` and `FEEDBAI_MATRIX_USER` in its environment. No database: GitHub issues and their hidden markers are the state.

**Cloudflare Workers** ([`worker.js`](worker.js), [`wrangler.jsonc`](../wrangler.jsonc) at the repo root; change the domain and `vars` for your own). From the repo root:

```sh
npx wrangler@4 deploy
node hub/setup.js --url https://your-hub.example --owner <github org>
npx wrangler@4 tail   # watch the next scheduled run
```

`wrangler deploy` first builds the website in `site/` (Node ≥ 22.23) and serves it from the same Worker. `hub/setup.js` serves a local page that creates the GitHub App (manifest flow) and logs the bot in; the App key and bot token go straight into the Worker's secrets, never to disk. Connecting the repo in Cloudflare (Workers Builds) deploys on push with the default commands.

Run only one hub per bot.

**Other runtimes**: the hub is one function, `runHub({ env })` in `hub/run.js`, using only `fetch` and `node:crypto`. Call it from any scheduled handler (e.g. AWS Lambda + EventBridge).
