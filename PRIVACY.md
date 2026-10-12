# Privacy

feedbai moves public feedback from chat and social channels to the people maintaining a project. This page says what personal data that involves, where it goes, and how to opt out or have it removed. It covers the feedbai software and the hosted hub at https://feedbai.internet4000.com run by internet4000.

## What is processed

From the channels a project configures:

- **Matrix**: your user id (e.g. `@you:matrix.org`), display name, message text, time, and links to the message.
- **Bluesky**: your handle, display name, post text, time, and links to the post.

Nothing else: no email addresses, IP addresses of message authors, contacts, or tracking. feedbai has no database. Its state is a list of "last read" times on the computer that runs it.

## When it is copied, and where

- **Read only**: running `feedbai` shows messages to the person (or agent) running it, on their computer. Nothing is stored beyond the "last read" time.
- **Filed as a GitHub issue** (`feedbai issues`, the hub): only Matrix threads where someone **mentions the project's bot**, plus Bluesky mentions and Bluesky threads a project follows explicitly. The issue quotes those messages with their links. Private Matrix rooms are filed only if their topic names the repository, which means the room's members agreed. Bluesky searches and author feeds are **never** filed.
- **The hosted hub** reads public Matrix rooms its bot was invited to and Bluesky search results, and serves them through its read API with a 60-second cache. It stores no messages. Cloudflare keeps operational logs (repository names, counts, errors) for a short time.

Services involved: the Matrix homeserver(s) and Bluesky, where the messages already are; GitHub, where issues are kept; Cloudflare, which runs the hub. GitHub and Cloudflare may process data outside the EU under their own data protection terms.

## Why (legal basis)

Legitimate interest (GDPR Art. 6(1)(f)): maintainers need to act on feedback that people chose to post in a project's public channels or address to its bot. The data is limited to what serves that purpose.

## Your choices

- **Don't mention the bot** (Matrix): your messages are then read by people running feedbai, but never filed.
- **Room admins**: kick the bot (`@feedbai:matrix.org`) to stop the hub. Leave the repository out of a private room's topic to keep the room out of issues.
- **Projects**: uninstall the feedbai GitHub App, or remove `feedbai.config.json`.

## Access, correction and erasure

An issue is kept by the repository it was filed in, and that project's maintainers can edit or delete it. To have your messages removed from any issue feedbai filed:

- for a repository of internet4000, or the hosted hub: write privately through the [advisory form](https://github.com/internet4000/feedbai/security/advisories/new) (it is private), or ask in `#feedbai:matrix.org` without repeating the content;
- for another project: contact its maintainers; the issue links to feedbai's repository.

Deleting a message on Matrix or Bluesky does not yet remove it from issues filed earlier. Ask as above.

## Running feedbai for your own project

You are then responsible for the data in your repository's issues. Keep the defaults (file only mentions; private rooms only with consent), link this page or your own notice from your room's topic, and answer removal requests.
