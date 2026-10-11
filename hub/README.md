# feedbai hub

Runs feedbai for every project that installed the feedbai GitHub App, so projects need no bot account, no secrets and no machine of their own.

**For a project**: invite the bot to your room, install the App on your repo, commit `feedbai.config.json` (`feedbai add matrix '#room:server'`). Mentions of the bot then become `feedback` issues within ~10 minutes.

**Rules** (any repo can install the App, so its config is untrusted):
- the hub always reads with its own bot account; `accounts` and `join` in a repo's config are ignored
- a repo may read a Matrix room only if the room is public, or its topic names the repo (`github.com/owner/repo`)
- the bot joins rooms only when invited; kick it to stop
- GitHub access is the App's installation token: issues write + contents read, per repo

**Run your own** (free software): create a bot account and a GitHub App (Issues: read & write, Contents: read), then either enable [`.github/workflows/hub.yml`](../.github/workflows/hub.yml) in a fork (secrets `FEEDBAI_APP_ID`, `FEEDBAI_APP_PRIVATE_KEY`, `FEEDBAI_HUB_MATRIX_TOKEN`, `FEEDBAI_HUB_MATRIX_USER`; variable `FEEDBAI_HUB_ENABLED=true`), or run `node hub/run.js` from cron with the same values as `FEEDBAI_APP_ID`, `FEEDBAI_APP_PRIVATE_KEY`, `FEEDBAI_MATRIX_TOKEN`, `FEEDBAI_MATRIX_USER`. No database: GitHub issues and their hidden markers are the state.
