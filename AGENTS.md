# feedbai — agent notes

Zero-dependency Node (>=22) CLI. Run `npm test` before committing.

- `src/cli.js` — arg parsing; `src/commands/<name>.js` — one file per command, `home.js` is bare `feedbai` (onboarding or status + new feedback).
- `src/feedback.js` — parallel fetch + `--since last` cursors; `src/format.js` — md/json/ndjson.
- `src/project.js`, `src/discover.js`, `src/edit.js` — detect the project, find channel links in the repo, edit `feedbai.config.json`.
- Output is agent-first: every message should say what to do next, with copy-pasteable commands.
- `src/config.js` — global + nearest project config, merged by id; accounts resolved per source.
- `src/providers/<type>.js` — one module per platform: `validate`, `authStatus`, `fetch`, `login`. Register in `providers/index.js`, add to `schemas/config.schema.json`, `cms/config.yml` and tests.
- All user-facing strings live in `src/locales/<lang>.json` and go through `t()`.
- Secrets are never stored in configs: accounts hold env var *names*; values live in `~/.config/feedbai/secrets.env` (0600).

To *use* feedbai on a project, see `skills/feedbai/SKILL.md`.
