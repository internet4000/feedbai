# How feedbai's agent triages feedback

Read by `feedbai triage` (and agents in sessions) before turning messages from our channels into issues.

- **What feedbai is:** a tool that gathers feedback from where a community talks, so a project's own agent can triage it, file issues and fix them, and reply. Feedback about feedbai itself (the CLI, the hub, the website, the Feedback button, the docs) is in scope.
- **File** a bug when something doesn't work as documented, or an idea when someone describes a change they need for a real project. One issue per problem: group messages that are about the same thing.
- **Don't file:** questions (they get an answer in the room), thanks and praise, design discussions between maintainers that don't end in a concrete request, status questions ("what's the status?"), tests ("you there?"), and anything from bots.
- **Titles:** what's wrong or what's wanted, from the user's point of view, in plain words, without names or @mentions. E.g. "Inviting the bot to a private room fails silently", not "oskar's invite".
- **Notes:** one or two sentences: the problem, and the likely cause or fix if it's obvious. Mention related issues by number when you know them (#70, #63…).
- **Security reports** never go into a public issue: classify them as a question so a maintainer answers privately (SECURITY.md).
