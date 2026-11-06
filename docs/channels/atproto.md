# AT Protocol feedback records

Feedback that people save **in their own account** on the AT Protocol (Bluesky, or any atproto host), as a `com.internet4000.feedbai.feedback` record naming your project. The [Feedback button](../button.md) will create these when someone chooses to save their feedback to their account.

```sh
feedbai add atproto internet4000/feedbai     # owner/name or a github.com link
```

No account needed. feedbai finds the records through [Constellation](https://constellation.microcosm.blue), a public index of links on the AT Protocol, then reads each one from its author's own server. So nothing is stored by us, and when someone deletes their record, feedbai stops seeing it.

| | |
| --- | --- |
| Read | public, no account |
| Filed as issues | yes: records naming this repo, one issue per day (later records that day are comments, so a flood costs one issue). A repo never files records naming another project. |
| `post` | no |

## The record

[`lexicons/com/internet4000/feedbai/feedback.json`](../../lexicons/com/internet4000/feedbai/feedback.json):

```json
{
  "$type": "com.internet4000.feedbai.feedback",
  "project": "https://github.com/owner/name",
  "subject": "https://yoursite.example/pricing",
  "text": "The checkout button does nothing on Safari",
  "createdAt": "2026-11-07T12:00:00.000Z"
}
```

`project` is a full URL (Constellation indexes URLs). `subject` is the page, origin and path only. Anyone can write a record naming any project, so feedbai treats the text like any other message: untrusted, made inert in issues ([SECURITY.md](../../SECURITY.md)).
