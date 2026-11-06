# Feedback button

A feedback button for any website. People write what works and what doesn't, then send it, publicly and from their own account, to a place feedbai already listens to:

- **a Bluesky post**, with your hashtag or handle and the page address;
- **a GitHub issue** in your repo, labelled `feedback`;
- **your Matrix room**, as a message that mentions the bot, so the [hub](../hub/README.md) (or your CI) files it as an issue;
- **their own Bluesky account**, as a feedback record: they sign in (allowing only that), and you read it with the [AT Protocol records](channels/atproto.md) channel: `feedbai add atproto you/yourproject`.

It needs no login and sets no cookies, and nothing goes through or stays on our servers: each choice opens that place prefilled, for the person to review and send. Saving to their account is the only choice with a sign-in, on its own page (`auth.feedbai.internet4000.com`), and the record goes straight to their account. This site uses it: the **Feedback** button at the bottom right.

## Add it to your site

One line, anywhere in the page:

```html
<script type="module" src="https://feedbai.internet4000.com/embed.js"
  data-project="https://github.com/you/yourproject"
  data-matrix="#yourproject:matrix.org"
  data-bluesky="#yourproject"></script>
```

| attribute | | |
| --- | --- | --- |
| `data-project` | required | your GitHub repo: the "GitHub issue" choice opens there |
| `data-matrix` | optional | your Matrix room alias: adds the "chat room" choice; invite the bot to the room |
| `data-bluesky` | optional | a hashtag or `@handle` added to Bluesky posts, so your [Bluesky source](channels/bluesky.md) finds them (e.g. `feedbai add bluesky search '#yourproject'`) |
| `data-bot` | optional | the Matrix bot to mention, if you [run your own hub](../hub/README.md) (default `@feedbai:matrix.org`) |
| `data-label` | optional | the button's text (default "Feedback") |

To place the button yourself instead of floating at the bottom right, load the script once (without `data-project`) and put the element where you want it:

```html
<script type="module" src="https://feedbai.internet4000.com/embed.js"></script>
<feedbai-button project="https://github.com/you/yourproject" matrix="#yourproject:matrix.org"></feedbai-button>
```

Add `inline` to show the form itself instead of a button.

## Without a script

Link to the same form on our site, for READMEs, emails, or sites that can't add scripts:

```
https://feedbai.internet4000.com/feedback?project=https://github.com/you/yourproject&matrix=%23yourproject:matrix.org&page=https://yoursite.example/pricing
```

## Privacy

Only the page's address is attached (origin and path: query strings and `#fragments` are dropped, they can hold tokens or personal data), and the person can remove it before sending. Everything they send is public, in the place they chose, and stays under their control there (they can delete it).

## Self-hosting

`embed.js` is one file with no dependencies ([`site/public/embed.js`](../site/public/embed.js)): serve your own copy to pin a version or to avoid loading a script from our domain.

## Next

The hub replying when it's fixed, and a page per project: see the [vision](vision.md).
