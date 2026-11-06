/** The ways to use feedbai: one tab, one route each (src/pages). `text` and `note` are trusted HTML from this file. */
export const BOT = '@feedbai:matrix.org'
const REPO = 'https://github.com/internet4000/feedbai'

export const WAYS = [
  {
    path: '/',
    tab: 'Hosted',
    hint: 'easiest',
    title: 'Hosted: nothing to run',
    lead: 'Our hub reads your chat and opens the issues. You install an App and invite a bot.',
    steps: [
      { text: '<b>Install the GitHub App</b> on your repository. This lets the hub open issues there.', button: { href: 'https://github.com/apps/feedbai', label: 'Install on GitHub' } },
      { text: '<b>Invite the bot</b> to your Matrix room.', copy: BOT, note: "The room must be public, or its topic must contain your repo's address (<code>github.com/you/repo</code>)." },
      { text: '<b>Connect the room to your repo.</b> In your project folder, run:', copy: 'npx github:internet4000/feedbai', note: "It finds your chat rooms and tells you what to add. Commit the <code>feedbai.config.json</code> it creates. That's it." },
    ],
    more: ['/docs/getting-started/', 'Getting started guide'],
  },
  {
    path: '/button',
    tab: 'Feedback button',
    hint: 'new',
    title: 'A feedback button on your site',
    lead: 'Visitors tell you what works and what doesn\'t, without leaving your site or creating an account. Try it: the Feedback button, bottom right.',
    steps: [
      { text: '<b>Add one line</b> to your site, with your repo (and your chat room, if you have one):', copy: '<script type="module" src="https://feedbai.internet4000.com/embed.js" data-project="https://github.com/you/repo"></script>' },
      { text: '<b>People write their feedback</b> and pick where to send it: a Bluesky post, a GitHub issue, or your chat room. It opens there prefilled, from their own account.' },
      { text: '<b>It reaches your issues</b> like any other feedback: the hub (or your CI) files the chat messages, agents read the rest.' },
    ],
    more: ['/docs/button/', 'Feedback button guide'],
  },
  {
    path: '/agent',
    tab: 'With your AI agent',
    title: 'With your AI agent',
    lead: 'Claude Code, Codex or any agent that runs commands reads the feedback, files issues, opens fixes and replies.',
    steps: [
      { text: '<b>Install feedbai</b> (Node 22 or later, no dependencies).', copy: 'npm i -g github:internet4000/feedbai' },
      { text: '<b>Run it in your project.</b> It finds your channels and prints what to add; commit <code>feedbai.config.json</code>.', copy: 'feedbai' },
      { text: '<b>Hand it to your agent.</b> In Claude Code type <code>!feedbai</code>, or ask “check user feedback”. To keep listening while it works:', copy: 'feedbai watch --as claude' },
    ],
    more: ['/docs/agents/', 'Agents and the triage workflow'],
  },
  {
    path: '/diy',
    tab: 'Without our servers',
    title: 'Without our servers',
    lead: 'Your own bot accounts, your own CI. Nothing goes through internet4000.',
    steps: [
      { text: '<b>Make a bot account</b> for your project on Matrix (and Bluesky if you want), invite it to your room, then log it in from your terminal:', copy: 'feedbai login matrix --user @yourproject-bot:matrix.org' },
      { text: '<b>Never fall back to our hub.</b> Add to your shell profile:', copy: 'export FEEDBAI_HUB=off' },
      { text: "<b>File issues from your CI.</b> Copy the workflow into your repo and add the bot's token as a secret.", button: { href: `${REPO}/blob/main/.github/workflows/feedbai.yml`, label: 'Get the workflow', ghost: true } },
    ],
    more: ['/docs/on-your-own/', 'Step-by-step guide'],
  },
  {
    path: '/self-host',
    tab: 'Run your own hub',
    title: 'Run your own hub',
    lead: 'One bot shared by your projects, team or community. A Cloudflare Worker, or any cron job. Free software, no database.',
    steps: [
      { text: '<b>Deploy it.</b> In a clone of feedbai, set your domain and account in <code>wrangler.jsonc</code>, then:', copy: 'npx wrangler@4 deploy' },
      { text: '<b>Create its GitHub App and log its bot in</b> from a local page; secrets go straight into the Worker:', copy: 'node hub/setup.js --url https://your-hub.example --owner your-org' },
      { text: '<b>Point people at it.</b>', copy: 'export FEEDBAI_HUB=https://your-hub.example' },
    ],
    more: ['/docs/hub/', 'The hub: rules and running your own'],
  },
  {
    path: '/give',
    tab: 'Give feedback',
    title: 'Give feedback on a project',
    lead: "You use a project that has feedbai. Tell its makers what works and what doesn't, where you already are.",
    steps: [
      { text: '<b>Look for its Feedback button</b>, often at the bottom right of its site: write, then pick where to send it.' },
      { text: '<b>No button? Join its chat room.</b> It\'s usually linked from its website or README. Any Matrix app works, for example <a href="https://app.element.io">Element</a>.' },
      { text: '<b>Write your message there and mention the bot.</b> It becomes an issue; they reply in the thread when it\'s fixed.', chat: `${BOT} the play button doesn't work on Safari` },
    ],
    more: ['/docs/vision/', 'Where this is going: feedback on any site'],
  },
]
