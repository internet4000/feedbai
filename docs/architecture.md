# Architecture

Where feedbai is going, decided on 2026-11-08: one simple architecture, the same for everyone, from one person to an organisation with hundreds of repositories. It builds on [an agent in the loop](https://github.com/internet4000/feedbai/issues/70). It is a plan: what exists today is in the [status issue](https://github.com/internet4000/feedbai/issues/12).

## Principles

1. **Security first, always.** No process ever holds untrusted text, secrets *and* the power to act together. Every token is scoped to one project and one job, and can be revoked. Nothing merges without a human.
2. **The same for everyone.** One program, one pipeline, the same tools. Only who runs it changes: us, you, or your organisation.
3. **Free software, self-hostable.** Everything we run is the open-source stack. Anyone can run it on their own domain, and nothing we host is required.
4. **Inclusive.** A person who has never used a terminal can set it up in one click. An organisation can run all of it itself.
5. **No setup by hand at scale, and no agent deciding what it touches.** Enrolling 300 repositories is one choice by a human; plain code does the setup; agents only ever see one project at a time.

## The runner

One program, the **feedbai runner** (the hub, grown up), runs for every enrolled project, each in its own sandbox, the same fixed pipeline:

| Stage | Sees untrusted text | Holds | Can | Is |
| --- | --- | --- | --- | --- |
| **Read** | yes, it fetches it | a read-only channel token | nothing else | `feedbai` (plain code) |
| **Triage** | yes | **no secrets, no tools** | only output JSON, checked against a schema (kind, title, summary, message links) | one model, chosen per account |
| **Act** | only the validated JSON | an issues-write token, the agent's channel token | file issues (`feedbai file`), react ✅ (`feedbai react`), post fixed replies | plain code, no model |
| **Code** (off by default) | only issues a human accepted | a token that can open pull requests, never merge | change code in a throwaway sandbox | Claude Code or Codex, chosen per account |
| **Reply** | no | the agent's channel token | "🤖 This is fixed: …" when a pull request closes the issue | plain code, a fixed template |

Whoever writes a message can only influence the triage model, which can't do anything but produce JSON. The stages that act are plain code. Tokens are injected by the runner (at best, added to outgoing requests by a proxy, so no stage ever sees them), short-lived where the platform allows (GitHub App tokens last an hour), and each stage may only reach the hosts it needs.

## No secrets to create

Copying tokens into settings is a chore and a risk. Projects get identities that platforms already provide:

- **GitHub:** the workflow's own token (issues), automatic.
- **The triage model:** the one thing that may need a key (OpenRouter, a provider), unless you triage in your own agent session or run a local model. There is no free model inside GitHub Actions anymore (GitHub Models was retired in July 2026).
- **Matrix and Bluesky:** the runner's bots act for a project that **proves which repository it is**, a short-lived token signed by its CI (GitHub Actions OIDC), in rooms whose admins tied them to it (the repository in the room topic). Nothing is created, copied or stored.

Only people running everything themselves create accounts, with one guided command (`feedbai agent setup`, to come), never by copying tokens.

## Enrolling projects: one click, not one setup per repository

- **Install the feedbai App** on your account or organisation and choose all repositories, or a selection. The runner works on exactly what the App was given. Uninstalling stops everything.
- **Where each project talks** (Matrix room, Bluesky handle…) is found by plain code, from links in the repository as `feedbai` already does, and proposed as **one pull request per repository**. A human merges it, or approves them in bulk.
- **Pausing one project:** a `.feedbai/pause` file in it.

## Configuration: one place per account, overrides where needed

A **`.feedbai` repository** per account or organisation (like GitHub's `.github`) holds:

- **defaults:** which model triages, whether the code stage is on, labels;
- **guidelines** ([#63](https://github.com/internet4000/feedbai/issues/63)): how your projects want feedback turned into issues, which every triage reads;
- the AI key's location (never the key itself).

A `feedbai.config.json` in a repository only says what differs: its channels, its own guidelines, turning the code stage on.

## Identities: one agent per project, created by the runner

People see, and room admins can kick or mute, one agent per project, never a person's own account and never one shared bot:

- **Matrix:** the runner has its own Matrix server with an application service (the Matrix mechanism for bots and bridges). It creates `@<project>:feedbai.internet4000.com` (or `@<project>:your.org` when you run it) the moment a project is enrolled, and issues **one revocable token per agent**. The master key stays in a small isolated service; each project's run only gets its own agent's token.
- **Bluesky:** handles under the same domain (`<project>.feedbai.internet4000.com`), with accounts on the runner's own Bluesky host (PDS), created the same way.
- **Forges:** the App's installation token, scoped to the repository, issues only (plus pull requests when the code stage is on).

Accounts created by hand don't scale to hundreds of projects; created by the runner, they're automatic and isolated.

## AI: bring your own key

One key per account or organisation, used for all its projects: Anthropic, OpenAI, or OpenRouter (many models behind one key). A small, cheap model triages; a strong coding agent writes code; replies need no model. On our hosted runner, people without a key can pay for usage instead. We never train on anything, and the triage only sees what a project's channels say.

## Who runs it

The same stack (the runner, a Matrix server, a Bluesky host), packaged to run as one `docker compose`:

| | Runs it | Agent identities | Pays |
| --- | --- | --- | --- |
| **A person, a small project** | our hosted instance at feedbai.internet4000.com: sign in, choose repositories, done | `@project:feedbai.internet4000.com` | nothing for open-source projects (to decide), usage beyond that |
| **Someone with many projects** (or friends) | our instance, or their own box | ours, or on their domain | their AI key; compute if hosted by us |
| **An organisation** | itself, on its own domain, with its own models and sign-in | `@project:their.org` | nothing to us |

Payments exist only on our hosted instance, through Stripe (we never see card details), for compute and optionally AI usage.

## The privacy trade-offs we accept, and their limits

- **A Matrix server keeps a copy of the rooms it joins** (that's how Matrix works). So on our hosted instance, agents join **public rooms only**, history is kept short and encrypted at rest, and the privacy notes say so. Private rooms need a self-hosted runner: your server, your data.
- **Our hosted instance holds state** (enrolled projects, encrypted secrets, schedules): a deliberate exception to "feedbai stores nothing", only there, never required, and absent when you run it yourself.
- **The master key** of a runner's Matrix application service is its most valuable secret: isolated, minimal code, rotated, audited.

## What this replaces

- **The shared `@feedbai:matrix.org` bot** filing every mention: replaced by per-project agents and a triage step ([#70](https://github.com/internet4000/feedbai/issues/70)). Until then it stays in public rooms only, with fixed texts ([SECURITY.md](../SECURITY.md#the-shared-hub-bot)).
- **Per-repository CI workflows** ([on your own](on-your-own.md)): still possible for one project, but not the way to run many.

## Build order

Each step is used on real projects before the next one starts.

1. **The runner on our own repositories:** today's hub plus the triage and act stages, with feedbai and radio4000 as the first projects, using their own agent accounts.
2. **Agent handles under our domain:** cheap, our Worker already proves handles.
3. **Our Matrix server and application service:** per-project agents created automatically, public rooms only.
4. **The `.feedbai` configuration repository** and the bulk setup pull requests: enrolling many repositories at once, for us and for friends.
5. **The self-hostable package** (one `docker compose`), with our instance as the reference.
6. **A web page to enrol without a terminal, then payments**, when people who aren't developers start using it.

## Open questions

- Free for open-source projects on our instance, and what does the hosted tier cost?
- Forgejo, Codeberg and GitLab have no GitHub-style Apps: what's the one-click enrolment there?
- End-to-end encrypted Matrix rooms: the runner would need full Matrix encryption support.
