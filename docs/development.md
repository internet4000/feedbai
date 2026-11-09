# Development

Zero-dependency Node (≥ 22). `npm test` runs everything (`node --test`).

## Layout

```
src/
  cli.js                 argument parsing → src/commands/<name>.js (one file per command; home.js is bare `feedbai`)
  config.js              global + project config, merged by id; accounts resolved per source
  feedback.js            parallel reads, per-agent "last run" cursors (state.js, since.js)
  roles.js               maintainer / agent / self, from authenticated author ids
  digest.js, format.js   threads; md / json / ndjson output
  issues.js, github.js   feedback → GitHub issues (idempotent markers)
  project.js, discover.js, edit.js   detect the project, find channel links, edit feedbai.config.json
  login.js, secrets.js   accounts and secrets.env
  hub.js                 reading through the hub
  providers/<type>.js    one module per channel; providers/index.js registers them
  locales/<lang>.json    every user-facing string, through t()
hub/                     the hosted hub (Cloudflare Worker): run.js, api.js, worker.js, setup.js
site/                    the website and docs (Astro + Starlight; its own dependencies)
skills/feedbai/          the agent skill
schemas/                 JSON schema for configs
docs/                    this documentation
```

## Principles

- **Agent-first output**: every message says what to do next, with a command ready to copy.
- **Core code never names a platform**: channel-specific behaviour lives in its provider ([adding a channel](channels/adding-a-channel.md)).
- **Trust boundaries**: project configs and messages are untrusted. Keep new code within [SECURITY.md](../SECURITY.md), and add a test when touching them. Personal data: [PRIVACY.md](../PRIVACY.md).

## Tests

`test/*.test.js` with `node:test`. HTTP is faked with `fakeFetch` from `test/helpers.js`. `test/providers.test.js` checks every registered channel against the provider contract.

## Languages

Messages live in `src/locales/<lang>.json`. feedbai picks the language from `FEEDBAI_LANG` or `LANG` and falls back to English for missing keys. To add a language, copy `en.json` and translate the values.

## The website and docs

https://feedbai.internet4000.com is [`site/`](../site/): Astro + Starlight, with its own `package.json` (the CLI keeps zero dependencies). The home page is an Astro page (`site/src/components/Home.astro`), the Feedback button one file (`site/public/embed.js`); the docs are the Markdown in this repo, copied into Starlight at build time by `site/scripts/sync-docs.mjs`, so they are written once and read the same on GitHub and on the site. A new doc goes in `DOCS` (`site/docs.mjs`); `test/site.test.js` fails until it's there, and the site build fails on any broken link or `#anchor` between pages.

```sh
cd site && npm install && npm run dev   # http://localhost:4321 (Node ≥ 22.23.4, see site/.nvmrc)
```

The hub Worker serves the built site (`assets` in `wrangler.jsonc`; `wrangler deploy` builds it first).

## The hub

See [hub/README.md](../hub/README.md). Pushing to `main` deploys it (Cloudflare Workers Builds); pull requests get a preview build.

## Release

Bump `version` in `package.json` and date the changelog (a pull request), then tag the merged commit:

```sh
git tag v0.4.0 && git push origin v0.4.0
```

The tag runs [`publish-to-npm-registry.yml`](../.github/workflows/publish-to-npm-registry.yml): checks the tag matches the version, tests, then `npm publish` with npm trusted publishing (provenance). A GitHub release with notes is optional.
