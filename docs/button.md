# Feedback button

A feedback button for any website. Clicking it opens a short dialog:

1. **What's on your mind?** One text box. The page's address is attached (removable).
2. **How do you want to send it?** Each place says what it needs, the one used last time first:
   - 💬 **Talk to the team**: your Matrix room (a Matrix account); the message is copied with a mention of the bot, so it becomes an issue.
   - 🦋 **Post on Bluesky**: a public post with your hashtag and the page (a Bluesky account).
   - 🐙 **Open an issue**: in your repo, labelled `feedback` (a GitHub account).
   - **No account?** It points to the quickest one to create, and keeps the text meanwhile.
3. **Almost done:** it opens there, written for them, to check and send from their own account. They'll get a reply there when it's done.

No login, no cookies, nothing goes through or stays on our servers. It's a native dialog (keyboard and screen-reader friendly), a bottom sheet on phones, and follows light and dark mode. This site uses it: the **Feedback** button at the bottom right.

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
| `data-records` | optional, experimental | also offer "Keep it in my Bluesky account": a feedback record in the person's own account, read with the [AT Protocol records](channels/atproto.md) channel |

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
