# Adding a channel

A channel (Slack, Microsoft Teams, Discord, Mastodon, Discourse, GitLab, a web form…) is one module in `src/providers/<type>.js`. Everything else in feedbai (config, `add`, `login`, discovery, `fetch`/`watch`, roles, digests, issues, `post`, help text and onboarding) works with whatever channels are registered. You don't edit any of it.

[`src/providers/github.js`](../../src/providers/github.js) (GitHub Discussions) is a small, complete example.

## Checklist

1. **`src/providers/<type>.js`**: the module described below.
2. **`src/providers/index.js`**: import it and add it to `providers`.
3. **`src/locales/en.json`**: the `channel.<type>.*` strings (below).
4. **`schemas/config.schema.json`**: add `<type>` to the source (and account) `type` enums, and a `oneOf` entry with its fields.
5. **`cms/config.yml`**: a `types` entry with the same fields.
6. **`test/<type>.test.js`**: `fetch` against a fake API (`test/helpers.js` → `fakeFetch`). `test/providers.test.js` already checks steps 2–5 for every registered channel.
7. **Docs**: a page in `docs/channels/<type>.md`, and a row in the channel table in [`docs/channels/README.md`](README.md).

Run `npm test`. The contract test fails with the name of whatever is missing.

## The module

```js
export default {
  type: 'slack',                        // the `type` in configs, and items' `platform`

  // Config
  validate(source) {},                  // throw (t('error.missingField', …)) when a field is missing or wrong
  describe: (source) => source.channel, // shown after the type: "slack #feedback"
  add: (words, opts) => ({ channel: words[0] }), // `feedbai add slack <words…>` → the source's fields
  discover: [{ regex, suggest }],       // optional: links a repo may mention → { value, args } for `feedbai add`

  // Accounts
  needsAuth: (source) => true,          // can this source be read without an account?
  authStatus: (account) => 'ok',        // 'ok' | 'missing' (account, no secret) | 'none' (no account) | 'hub'
  envAccount: (env) => null,            // optional: an account from env vars (CI, the hub)
  async authenticate(opts, { promptHidden }) {}, // optional: `feedbai login slack` → { account, secrets }

  // Reading
  async fetch({ project, source, account, since, limit, fetchImpl }) {}, // → items, or { items, notices }
  async ancestors({ project, source, account, entry }) {}, // optional: messages a reply points to, for context

  // Filing (feedback → GitHub issues)
  filing: 'mentions',                   // optional: only messages that mention the bot start an issue (chat rooms)
  files: (source) => true,              // optional: false keeps a source read-only (sentiment, or already a tracker)
  async mayFile({ source, account, repo }) {}, // optional: may this source go into `repo`'s issues? (private rooms)

  // Replying
  parseLink: (link) => null,            // optional: a message link → where `post` replies
  async post({ account, source, text, replyTo, ...where }) {}, // optional: `feedbai post` → link to the message
}
```

### Items

`fetch` returns items made with `item()` from [`src/model.js`](../../src/model.js), oldest first:

| field | |
| --- | --- |
| `id` | platform id, unique in the channel |
| `platform` | the provider's `type` |
| `project`, `source` | `project.id`, `source.id` |
| `author` | `{ id, name? }`: the platform-authenticated id (roles are matched on it: `maintainers`, `agents`) |
| `text` | plain text |
| `url` | a link a person can open |
| `createdAt` | ISO date |
| `replyTo`, `thread` | optional: the parent item's id and the thread root's id (digests and issues group by them) |
| `mentions` | optional: user ids the message explicitly mentions (for `filing: 'mentions'`) |
| `edits` | optional: id of the item this one edits |

Respect `since` (a `Date` or null) and `limit`: stop paginating once items are older than `since`. Use `request()` from [`src/http.js`](../../src/http.js) for HTTP (it gives readable errors and takes `fetchImpl` for tests). Read secrets with `getSecret(account.secrets.<field>)`, never from config values.

### Strings

In `src/locales/en.json` (other languages fall back to English):

| key | used in |
| --- | --- |
| `channel.<type>.name` | `feedbai help` title, error messages |
| `channel.<type>.add` | `feedbai help`: the `feedbai add <type> …` lines, two-space indented |
| `channel.<type>.login` | `feedbai help` and onboarding: the `feedbai login <type>` line (only with `authenticate`) |
| `channel.<type>.hint` | "needs an account → run `…`" after `add` and in source status |
| `channel.<type>.setup` | onboarding (bare `feedbai` in a project with no channels): what to offer the user |

## Rules to keep

These are what keep feedbai safe to run on untrusted channels ([SECURITY.md](../../SECURITY.md)):

- **Secrets**: accounts hold env var *names*. `authenticate` returns `{ account, secrets }` and feedbai stores the values in `secrets.env` (0600). A project config never picks accounts.
- **Authors**: `author.id` must be the id the platform authenticated, never a name taken from the message text.
- **Private channels**: if a source can be private, implement `mayFile` so private messages reach a repo's issues only when the channel says it belongs to that repo.
- **Chat is not a backlog**: for chat rooms set `filing: 'mentions'`. For channels that are already a tracker or a firehose (searches, discussions), set `files: () => false`; agents read them and file what matters.

## The hub

The hosted hub ([`hub/`](../../hub/README.md)) files issues for every repo with the feedbai GitHub App, using the hub's own accounts (`envAccount`). For a new channel to work there too, the hub needs an account for it (a Worker secret). To let people read it without an account, add a read endpoint in [`hub/api.js`](../../hub/api.js) and fall back to it in `fetch` with `readViaHub` (see `matrix.js` and `bluesky.js`).
