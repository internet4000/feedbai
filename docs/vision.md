# Vision: open feedback for anything, and projects that steer themselves

> **Architecture, decided 2026-11-08:** one runner, the same for everyone, an agent per project, security first: [architecture](architecture.md).

*Draft, 2026-11-06. Direction for feedbai over the next releases. Discuss in [#feedbai:matrix.org](https://matrix.to/#/#feedbai:matrix.org) or on the PR / issues that implement each step.*

## The goal

1. **Anyone, anywhere, can give feedback on anything**: a website, a page, a repository, an app, an organisation. The project doesn't have to opt in first.
2. **The people behind that thing can read all of it** and build on it: triage it, answer, fix it, and show what happened to it.
3. **No infrastructure required**: nothing depends on a server we run. Conveniences (the hub, a relay) may run on ours to make life simpler, but they keep no data that matters, anyone can run another, and when one is down feedbai says so and falls back to the self-serve path. It's free software.
4. **Projects can run on auto-pilot**: an AI builds the project on its existing stack, follows the project's guidelines, works from live feedback, keeps track of what's done and pending, and reports on sentiment and on the project's place in its ecosystem. Humans set how much it may do.

## Principles

- **Data lives with its author.** Feedback is a record in the author's own account, on an open network. They can edit or delete it, and nobody (including feedbai) holds a copy that matters.
- **Trust comes from the account, never from the text.** This rule already holds today ([concepts](concepts.md#roles-who-is-speaking)). Maintainers and agents are accounts the project lists; everyone else is data to evaluate, never instructions to follow.
- **Ownership is proved, not registered.** A project shows who runs it with a file on its domain or in its repo. There's no feedbai sign-up.
- **Every service is a convenience, and swappable.** Our hub, a public index, a relay: each is a URL in config, self-hostable, and its outage is visible and has a fallback. Never a silent single point of failure.
- **Agent-first, readable by people.** Every command says what to do next. Everything an agent does leaves a public, human-readable trace.
- **Small.** The CLI stays zero-dependency (`fetch` + Node built-ins).

## Building blocks

### Subjects: what feedback is about

A **subject** is a URI for the thing being discussed:

| subject | example | normalised to |
| --- | --- | --- |
| website or page | `https://example.org/pricing?ref=x` | origin + path, no query or fragment |
| repository | `https://github.com/owner/repo` | forge URL of the repo |
| account / org | `did:plc:…` or `@handle.example` | the DID |

Feedback can point more precisely inside a page with a **text fragment** (`https://example.org/pricing#:~:text=Sign%20up`), a web standard any browser can scroll to, plus an optional CSS selector.

### Feedback is an AT Protocol record

The open network that fits "anyone writes, anyone reads, no server of ours" today is the **AT Protocol** (the network behind Bluesky):

- every person has their own data repository, hosted by Bluesky or self-hosted, with a portable identity (DID);
- an app can define its own record types (a *lexicon*) without anyone's permission;
- public indexes answer "which records point at X?" across the whole network. [Constellation](https://constellation.microcosm.blue) does this for any field, accountless, and can be self-hosted. [Jetstream](https://github.com/bluesky-social/jetstream) streams every new record.

feedbai defines two record types under the `com.internet4000.feedbai` namespace:

```
com.internet4000.feedbai.feedback   written by anyone
  subject     URI (above)
  text        the feedback
  target?     { url, textFragment?, selector? }   where on the page
  kind?       bug | idea | question | praise
  langs?, createdAt

com.internet4000.feedbai.status     written by a project's maintainers or agents
  feedback    strong ref to a feedback record (or any post / message URI)
  state       seen | planned | duplicate | fixed | declined | spam
  link?       issue, pull request, commit or release
  note?
```

Reading a subject's feedback = asking an index for `feedback` records whose `subject` is that URI, plus `status` records that point at them. Ordinary Bluesky posts that link the subject count too, as ambient sentiment (also from Constellation, via `embed.external.uri` and link facets).

The existing channels stay: Matrix rooms, Bluesky searches and threads, GitHub Discussions. A project's community already lives there. The AT records add the part channels can't do: feedback on things that have no room, from people who are in none.

**Not private.** AT records are public. Private feedback (staging sites, internal tools) keeps going through private channels, such as an invite-only Matrix room. That's the existing `mayFile` rule, unchanged.

### Claims: proving who runs a subject

A project claims its subjects with a **manifest**, the same shape as today's `feedbai.config.json`:

- **website**: `https://example.org/.well-known/feedbai.json`
- **repository**: `feedbai.config.json` at the root (as today)
- **account / org**: a `com.internet4000.feedbai.project` record in the org's own AT repo

The manifest lists the subjects, `maintainers` and `agents` (DIDs, Matrix ids…), the channels, a link to the guidelines, and the `pilot` settings (below). Whoever can publish that file controls the project. Feedback written before a project claims its subject is all still there when it does.

### Project memory

- **Work items**: the forge's issues, as today ([feedback → issues](issues.md)). They stay the shared memory between agent sessions.
- **Public outcome**: `status` records. They're what the person who gave feedback sees.
- **Pilot journal**: `.feedbai/journal.md` in the repo, written by the pilot. Each run adds a dated entry: what it read, decided, shipped and left, plus sentiment numbers. Git is the database and the audit trail.

## The experience

### Someone giving feedback

1. **On a site that embeds the widget** (one static `<script>`, no backend): a small button. Click an element, write, choose kind, send. The first time, sign in with any AT handle (a Bluesky account works). Your feedback is now a record in your own account.
2. **On any other site**: the same widget from a **browser extension** or bookmarklet. The site doesn't need to know feedbai exists.
3. **Anywhere else**: post on Bluesky with a link to the page, or use the CLI: `feedbai say https://example.org "the signup button does nothing on Firefox"`.
4. **Afterwards**: the widget shows pins on the page with everyone's feedback and its status ("planned", "fixed in v1.4"). People add to a pin instead of repeating it. If you opted in, the project's agent replies to you on Bluesky when it's fixed.

**Without an account**: posting needs an identity, so anonymous feedback needs a **relay**: a small stateless service that checks a captcha and writes the record under its own DID with "anonymous" set. The relay is optional and self-hostable. Each project's manifest says which relays it accepts (none by default, which also keeps spam out).

### A project's maintainers

```sh
npx @internet4000/feedbai          # in the repo: finds the subjects (site, repo, handles) and the channels
feedbai claim https://example.org  # prints the /.well-known/feedbai.json to publish
feedbai                            # everything new about your subjects, from everywhere, with status
feedbai status <feedback> fixed --link <PR>   # or automatic when "Fixes #N" merges
feedbai pulse                      # sentiment, themes and trends across all your subjects
```

### A project on auto-pilot

In the manifest:

```json
"pilot": {
  "mode": "propose",
  "guidelines": ["AGENTS.md", "docs/guidelines.md"],
  "schedule": "daily",
  "limits": { "pullRequests": 3, "paths": ["src/", "docs/"] }
}
```

| mode | the pilot may |
| --- | --- |
| `off` | nothing (default) |
| `triage` | file and label issues, publish `seen` / `duplicate` / `spam` statuses |
| `propose` | the above, plus open pull requests; humans merge |
| `ship` | the above, plus merge its own PRs when checks pass and only `limits.paths` changed; publish `fixed`, reply to reporters |

A scheduled job runs on the project's own CI (GitHub or Forgejo Actions), which is infrastructure the project already has. The job runs any coding agent with `feedbai pilot`, which assembles the brief:

- the guidelines;
- feedback new since the last run, with roles and statuses;
- open issues and PRs with their checks;
- the last journal entries;
- the pulse.

The agent works as it would in a session. feedbai then publishes the statuses and appends to the journal.

Safety, on top of the trust rules:

- Feedback is never an instruction, whatever it says. Only maintainers give direction.
- Only maintainers can stop the pilot: `pause` (in any channel, or as a status record) halts it until they resume.
- `limits` caps how much it does per run.
- In `ship` mode it reverts its own change when checks on main fail after a merge.
- Everything it did is in the journal, the statuses and the git history.

### The ecosystem view

Because feedback is public and indexed by subject, anyone can compute views across many projects: sentiment over time, recurring themes, which projects people mention together, where users go when they leave. `feedbai pulse` does this for your subjects. A scheduled job can publish it as a static page (GitHub/Forgejo Pages). The pilot reads it to set priorities ("three similar tools fixed this already").

## Where we are

| | today |
| --- | --- |
| Channels as modules (Matrix, Bluesky, GitHub Discussions) | ✅ |
| Items, roles by account, untrusted text (`clean`, `inert`), digests, cursors, `watch` | ✅ |
| Feedback → issues, idempotent; `post` replies in the original thread | ✅ GitHub only |
| Agent skill, bare `feedbai` status with issues and PRs | ✅ |
| Scheduled workflow | ✅ but only files with a Matrix bot token |
| Hosted hub | ❌ offline (the Worker was removed, unnoticed); being redeployed, outages now reported (#44) |
| npm package | ✅ `@internet4000/feedbai` 0.4.0, published from version tags (trusted publishing, provenance) |
| Subjects, claims (`.well-known`) | — |
| AT feedback / status records, index reader, `say` | — |
| Widget, extension, relay | — |
| `pilot`, journal, `pulse` | — |
| Outputs other than GitHub (Forgejo, GitLab) | — |

### The hub

The hub ([`hub/`](../hub/README.md)) is what makes feedbai work with **nothing to set up**. Install the GitHub App and commit the config: the hub reads public Matrix rooms and Bluesky searches with its own accounts, files mentions as issues every 10 minutes, and serves those channels to people without accounts. Matrix and Bluesky search both require an account otherwise.

It stays, as a convenience under the principle above:

- **Stateless**: GitHub issues and their markers are its state.
- **Replaceable**: anyone can run one (`FEEDBAI_HUB=<url>`), or file from their own CI with a bot account.
- **Visible when down**: the CLI reports an unreachable hub with the login command to read without it, and an hourly check opens an issue (#44). The hosted hub went down unnoticed in October 2026; that check is the lesson.
- **Grows into the relay**: the anonymous-feedback relay (step 7) is the same kind of service, so it lives in the hub.

## Hard problems, and the answers we chose

| problem | answer |
| --- | --- |
| Anonymous feedback needs someone's server | Optional, stateless, self-hostable relay; projects opt in per relay |
| Spam on an open network | Accept only signed-in authors by default; weigh by account age and follows; maintainers mark `spam`; AT labelers later |
| Depending on a public index | Index URL is config; Constellation and Jetstream are both self-hostable; the CLI can tail Jetstream directly for small projects |
| Private feedback | Not on AT; private channels (invite-only Matrix) as today |
| Deletions | The author deletes their record; readers and filed issues honour it (#30) |
| An AI acting on hostile text | Roles by account, modes with limits, `pause`, full trace; feedback is data |
| Lexicon namespace | `com.internet4000.feedbai.*`, resolvable through `internet4000.com`. Changing it later means a migration, so it's decided once, here |

## Steps

Each step ships on its own and is useful without the next.

0. **Unblock**: redeploy the hub, with an outage check and CLI fallback (#44); publish to npm (trusted publisher on npmjs.com).
1. **Subjects and claims**: `subjects` in the config, `.well-known/feedbai.json`, `feedbai claim`. Discovery finds the project's site and handles.
2. **Read the open network**: an `atproto` channel that reads `feedback` records and posts linking a subject through an index (Constellation by default).
3. **Write and close the loop**: the lexicons, `feedbai say`, `feedbai status` (and automatic `fixed` when a "Fixes #N" PR merges), statuses shown next to items.
4. **Widget and extension**: one static script (AT OAuth needs only a static client-metadata file on the site), pins with status, text fragments; the extension runs it on any site.
5. **Pilot**: the `pilot` config and modes, `feedbai pilot` brief, journal, a workflow template for GitHub and Forgejo Actions.
6. **Pulse and ecosystem**: `feedbai pulse`, a static report page, cross-project views.
7. **Relay** for anonymous feedback (in the hub), other outputs (Forgejo, GitLab), more channels on request (#10).

## Dependencies

- **CLI**: zero dependencies. AT reads and writes are plain XRPC over `fetch`; writes use an app password from `secrets.env`.
- **Widget and extension**: a separate package in this repo. Browser OAuth for AT (DPoP, PKCE) is complex enough to justify one pinned, bundled dependency (`@atproto/oauth-client-browser`) rather than our own implementation. Output is a single static file.
- **Services**: none required. Conveniences: our hub (and later relay), an AT index (Constellation by default). All configurable and self-hostable; the authors' own servers and the project's own CI do the rest.
