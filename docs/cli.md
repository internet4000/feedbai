# CLI reference

`feedbai help` prints the same list, including every registered channel's `add` and `login` forms.

## Commands

| command | does |
| --- | --- |
| `feedbai` | This project: setup guide if it has no channels; otherwise each channel's status and the feedback new since your last run, then what to do next. Moves your cursor. |
| `feedbai fetch` | Feedback from every configured project (filter with `--project`, `--source`). Doesn't move cursors unless `--since last`. |
| `feedbai sources` | Each source and whether it can be read (`ok`, `ok (public)`, `via the hub`, `needs an account`). `--format json` for a list. |
| `feedbai add <type> …` | Add a source to the project's `feedbai.config.json` (created at the git root if missing). Forms per channel: [channels](channels/README.md). |
| `feedbai remove <source-id>` | Remove a source. |
| `feedbai login <type> …` | Save an account; prompts for the secret. Run it in your own terminal. Forms per channel: [channels](channels/README.md). |
| `feedbai watch` | Keep polling; print one line per new item on stdout, status on stderr. Polls every `--interval` seconds (default 60), slowing down to 15 minutes while quiet. Skips `[agent]` messages. |
| `feedbai issues` | File feedback as GitHub issues in this repo ([feedback → issues](issues.md)). `--dry-run` shows what it would do. Default window `--since 1d`. |
| `feedbai post <link\|source-id> <text>` | Reply in a thread (a message link) or post to a source; the text is prefixed with 🤖. `-` reads the text from stdin. Matrix for now. |
| `feedbai skill` | Print the agent workflow ([skills/feedbai/SKILL.md](../skills/feedbai/SKILL.md)). |
| `feedbai skill install` | Link the skill into `~/.claude/skills`, `~/.codex/skills`, `~/.pi/agent/skills` (for the agents installed). |
| `feedbai paths` | Where the global config, project config, secrets and state are. |
| `feedbai help`, `-h` | Usage. |

## Options

| option | |
| --- | --- |
| `--as <agent>` | Whose "last run" cursor to use and move (e.g. `claude`, `codex`). Default: `FEEDBAI_AGENT`, else `default`. |
| `--since <when>` | `30m`, `12h`, `7d`, `2w`, an ISO date, or `last` (since this agent's last run; the default for bare `feedbai` and `watch`). A window never moves the cursor. |
| `--limit <n>` | Most items per source (default 50, or the source's `limit`). |
| `--format <fmt>` | `md` (default), `json` (`{ groups: [{ project, source, platform, items, notices? }], errors }`), `ndjson` (one item, notice or error per line). |
| `--project <id>`, `--source <id>` | Only that project / source. |
| `--config <file>` | Use this project config instead of the nearest `feedbai.config.json`. |
| `--id <id>` | `add`: the new source's id (default: the type, plus the mode). |
| `--account <id>` | `add`: read with this account. `login`: the account id to save. `post`: send with this account. |
| `--join` | `add matrix`: join the room on first read. |
| `--interval <s>` | `watch`: seconds between polls. |
| `--dry-run` | `issues`: print the planned issues and comments. |
| `--user`, `--token`, `--homeserver` | `login matrix` |
| `--identifier`, `--service` | `login bluesky` |

## Environment

| variable | |
| --- | --- |
| `FEEDBAI_AGENT` | Default for `--as`. |
| `FEEDBAI_HUB` | `off` disables the hub; a URL points at another hub. Default `https://feedbai.internet4000.com`. |
| `FEEDBAI_CONFIG` | Global config file (default `~/.config/feedbai/config.json`, under `XDG_CONFIG_HOME`). |
| `FEEDBAI_SECRETS` | Secrets file (default `~/.config/feedbai/secrets.env`). Variables already set in the environment win over it. |
| `XDG_STATE_HOME` | State (cursors) under `feedbai/state.json` (default `~/.local/state`). |
| `FEEDBAI_LANG`, `LANG` | Message language (falls back to English). |
| `FEEDBAI_MATRIX_TOKEN`, `_USER`, `_HOMESERVER` | A Matrix account from the environment (CI). |
| `FEEDBAI_BLUESKY_IDENTIFIER`, `_PASSWORD` | A Bluesky account from the environment. |
| `GH_TOKEN`, `GITHUB_TOKEN` | GitHub: the account for GitHub Discussions, and the token `feedbai issues` files with (else `gh auth token`). |
| `GH_REPO`, `GITHUB_REPOSITORY` | `issues`: the repo to file into (else the git remote). |

Accounts from the environment are used when the config has no account of that type.

## Exit codes

| code | |
| --- | --- |
| `0` | ok |
| `1` | usage or config error (the message says how to fix it) |
| `2` | some sources failed; the others were read, and the failures are listed under "Errors" |
