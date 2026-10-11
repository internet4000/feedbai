# feedbai hub

Runs feedbai for every project that installed the feedbai GitHub App, so projects need no bot account, no secrets and no machine of their own.

Hosted at **https://feedbai.internet4000.com** (Cloudflare Worker, every 10 minutes).

**For a project**: invite the bot (`@feedbai:matrix.org`) to your room, install the App on your repo, commit `feedbai.config.json` (`feedbai add matrix '#room:server'`). Mentions of the bot then become `feedback` issues within ~10 minutes.

**For people and agents without a Matrix account**: the CLI reads public rooms through the hub's read API when no Matrix account is configured, as long as the bot is in the room. `GET /v1/matrix?room=#room:server[&since=ISO][&limit=n]` returns the same items as `feedbai fetch --format json` (cached 60s). Private rooms are not served.

**Rules** (any repo can install the App, so its config is untrusted):
- the hub always reads with its own bot account; `accounts` and `join` in a repo's config are ignored
- a repo may read a Matrix room only if the room is public, or its topic names the repo (`github.com/owner/repo`)
- the bot joins rooms only when invited; kick it to stop
- GitHub access is the App's installation token: issues write + contents read, per repo

**Run your own** (free software): create a bot account and a GitHub App (Issues: read & write, Contents: read), then either enable [`.github/workflows/hub.yml`](../.github/workflows/hub.yml) in a fork (secrets `FEEDBAI_APP_ID`, `FEEDBAI_APP_PRIVATE_KEY`, `FEEDBAI_HUB_MATRIX_TOKEN`, `FEEDBAI_HUB_MATRIX_USER`; variable `FEEDBAI_HUB_ENABLED=true`), or run `node hub/run.js` from cron with the same values as `FEEDBAI_APP_ID`, `FEEDBAI_APP_PRIVATE_KEY`, `FEEDBAI_MATRIX_TOKEN`, `FEEDBAI_MATRIX_USER`. No database: GitHub issues and their hidden markers are the state.

**Cloudflare Workers** ([`worker.js`](worker.js), [`wrangler.jsonc`](wrangler.jsonc); change the domain and `vars` for your own):

```sh
cd hub
npx wrangler@4 deploy
npx wrangler@4 secret put FEEDBAI_APP_ID
npx wrangler@4 secret put FEEDBAI_APP_PRIVATE_KEY < app.private-key.pem
npx wrangler@4 secret put FEEDBAI_MATRIX_TOKEN
npx wrangler@4 tail   # watch the next scheduled run
```

Run only one hub per bot (Worker or the Actions workflow), not both.

**Other runtimes**: the hub is one function, `runHub({ env })` in `hub/run.js`, using only `fetch` and `node:crypto`. Call it from any scheduled handler (e.g. AWS Lambda + EventBridge).
