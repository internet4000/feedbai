# Configuration

feedbai reads two files and merges them:

| file | holds | shared? |
| --- | --- | --- |
| `feedbai.config.json` at the project root (the nearest one up from the current directory) | the project, its channels, maintainers and agents | yes: commit it |
| `~/.config/feedbai/config.json` (global) | your accounts, and any extra projects | no: personal |

Secrets are in neither: they live in `~/.config/feedbai/secrets.env` (mode 600) or in environment variables. `feedbai paths` shows where each file is.

Both files have the same shape and are validated by [`schemas/config.schema.json`](../schemas/config.schema.json). Add `"$schema": "https://raw.githubusercontent.com/internet4000/feedbai/main/schemas/config.schema.json"` for completion in editors (`feedbai add` does). Projects and sources are merged by `id`: the project file's entries override the global file's.

## Project config

```json
{
  "$schema": "https://raw.githubusercontent.com/internet4000/feedbai/main/schemas/config.schema.json",
  "projects": [
    {
      "id": "radio4000",
      "name": "Radio4000",
      "repository": "https://github.com/internet4000/radio4000",
      "maintainers": ["@you:matrix.org", "you.bsky.social"],
      "agents": ["@yourbot:matrix.org"],
      "sources": [
        { "id": "matrix", "type": "matrix", "room": "#radio4000:matrix.org" },
        { "id": "bluesky-search", "type": "bluesky", "mode": "search", "query": "radio4000" },
        { "id": "github", "type": "github", "repo": "internet4000/radio4000" }
      ]
    }
  ]
}
```

### Project fields

| field | |
| --- | --- |
| `id` | required; letters, digits, `._@:-` |
| `name` | optional display name |
| `repository` | the repo's URL (`feedbai add` fills it from the git remote) |
| `sources` | the channels to read (below) |
| `maintainers` | author ids (Matrix user ids, Bluesky handles…) whose messages are marked `[maintainer]`: direction for agents, not just feedback |
| `agents` | author ids of bots that work on the project: marked `[agent]`, never open an issue, skipped by `watch` |

### Source fields

Every source has:

| field | |
| --- | --- |
| `id` | required, unique in the project (`feedbai add` picks one; `--id` to choose) |
| `type` | the channel: `matrix`, `bluesky`, `github`, … |
| `limit` | most items per read (default 50) |
| `account` | read with this account id (default: the first account of the same type) |

The other fields depend on the channel: [Matrix](channels/matrix.md), [Bluesky](channels/bluesky.md), [GitHub Discussions](channels/github.md).

You can edit the file by hand, with `feedbai add` / `feedbai remove`, or with the [Sveltia/Decap CMS collection](../cms/config.yml) (accounts are left out on purpose).

## Global config and accounts

`feedbai login <type>` writes accounts to the global config, and their secrets to `secrets.env`:

```json
{
  "accounts": [
    {
      "id": "matrix-@you:matrix.org",
      "type": "matrix",
      "homeserver": "https://matrix.org",
      "user": "@you:matrix.org",
      "secrets": { "token": "FEEDBAI_MATRIX_YOU_MATRIX_ORG_TOKEN" }
    }
  ],
  "projects": []
}
```

An account's `secrets` maps a field (`token`, `password`) to the **name** of an environment variable. feedbai loads `secrets.env` into the environment at start, without overriding variables that are already set, so CI can provide the same names.

| account fields | |
| --- | --- |
| `id`, `type` | required |
| `secrets` | required: field → env var name |
| `homeserver`, `user` | Matrix |
| `service`, `identifier` | Bluesky (PDS URL, handle) |
| `user` | GitHub (login) |

Rules:

- **Keep accounts in the global config.** A project config is shared and may come from anyone (the hub reads every installed repo's), so feedbai ignores accounts there, and a source's `account` can only pick one of yours. See [SECURITY.md](../SECURITY.md).
- **Accounts from the environment** (`FEEDBAI_MATRIX_TOKEN`, `FEEDBAI_BLUESKY_PASSWORD`, `GH_TOKEN`…; [CLI → environment](cli.md#environment)) are used when no configured account of that type exists.
- **No account** for a source that needs one: feedbai reads through the [hub](../hub/README.md) when the channel supports it, otherwise the source says which `feedbai login …` to run.

## Other projects

The global config can list projects too, e.g. ones whose repo you don't control, so `feedbai fetch` reads them all. Bare `feedbai` only shows the project you're in.
