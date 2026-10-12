# GitHub Discussions

Reads a repository's Discussions: each discussion is a thread (the post, its comments, and replies to comments).

```sh
feedbai add github discussions owner/name       # or a github.com link to the repo
```

| source field | |
| --- | --- |
| `repo` | required: `owner/name` or a github.com link |

Each read looks at the 25 most recently updated discussions, with their latest 50 comments and 20 replies per comment.

## Account

GitHub's API needs a token, even for public discussions:

- `GH_TOKEN` or `GITHUB_TOKEN` in the environment (in GitHub Actions, `${{ github.token }}` can read the repo's own Discussions), or
- `feedbai login github`: paste a token. A fine-grained token with read-only access to Discussions is enough, or use `gh auth token`.

## What gets filed

Nothing on its own: Discussions are already a place for conversation on GitHub, and copying every post into an issue would only duplicate them. Agents read them with the rest of the feedback and file what's actionable ([agents](../agents.md)).
