/**
 * Which repo files the website serves as docs, where, and in which menu group. The Markdown stays in the
 * repo (docs/, hub/README.md, PRIVACY.md, SECURITY.md): scripts/sync-docs.mjs copies it into Starlight,
 * so GitHub and the site show the same files. Plain Node, no dependencies: test/site.test.js checks it.
 */
export const REPO = 'https://github.com/internet4000/feedbai'

/** route: the page's path on the site (no trailing slash); label: its menu name, when not its title. */
export const DOCS = [
  { group: 'Start', file: 'docs/README.md', route: '/docs', label: 'Overview' },
  { group: 'Start', file: 'docs/getting-started.md', route: '/docs/getting-started' },
  { group: 'Start', file: 'docs/concepts.md', route: '/docs/concepts' },
  { group: 'Start', file: 'docs/agents.md', route: '/docs/agents' },
  { group: 'Start', file: 'docs/issues.md', route: '/docs/issues' },
  { group: 'Start', file: 'docs/button.md', route: '/docs/button' },
  { group: 'Start', file: 'docs/on-your-own.md', route: '/docs/on-your-own', label: 'On your own' },
  { group: 'Reference', file: 'docs/cli.md', route: '/docs/cli' },
  { group: 'Reference', file: 'docs/configuration.md', route: '/docs/configuration' },
  { group: 'Reference', file: 'docs/channels/README.md', route: '/docs/channels', label: 'Channels' },
  { group: 'Reference', file: 'docs/channels/matrix.md', route: '/docs/channels/matrix' },
  { group: 'Reference', file: 'docs/channels/bluesky.md', route: '/docs/channels/bluesky' },
  { group: 'Reference', file: 'docs/channels/github.md', route: '/docs/channels/github' },
  { group: 'Reference', file: 'docs/channels/atproto.md', route: '/docs/channels/atproto', label: 'AT Protocol records' },
  { group: 'Reference', file: 'hub/README.md', route: '/docs/hub', label: 'The hub' },
  { group: 'Project', file: 'docs/vision.md', route: '/docs/vision', label: 'Vision' },
  { group: 'Project', file: 'docs/channels/adding-a-channel.md', route: '/docs/channels/adding-a-channel' },
  { group: 'Project', file: 'docs/development.md', route: '/docs/development' },
  { group: 'Project', file: 'PRIVACY.md', route: '/docs/privacy', label: 'Privacy' },
  { group: 'Project', file: 'SECURITY.md', route: '/docs/security', label: 'Security' },
]

/** A link written in a repo file, as the site serves it: another doc → its route; any other repo file → GitHub. */
export const resolveLink = (from, href) => {
  if (/^[a-z][a-z+.-]*:/i.test(href) || href.startsWith('#') || href.startsWith('//')) return href
  const url = new URL(href, `https://repo.invalid/${from}`)
  const path = decodeURIComponent(url.pathname.slice(1))
  const doc = DOCS.find((d) => d.file === path || d.file === `${path.replace(/\/$/, '')}/README.md`)
  if (doc) return `${doc.route}/${url.hash}`
  return `${REPO}/${path.endsWith('/') || !/\.\w+$/.test(path) ? 'tree' : 'blob'}/main/${path}${url.hash}`
}

/** A repo Markdown file as a Starlight page: its `# Title` becomes frontmatter, links outside code are rewritten. */
export const toPage = (doc, markdown) => {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const h1 = lines.findIndex((l) => /^# /.test(l))
  const title = h1 >= 0 ? lines[h1].slice(2).replace(/`/g, '').trim() : doc.file
  if (h1 >= 0) lines.splice(h1, 1)
  let fence = null
  const body = lines.map((line) => {
    const open = line.match(/^ *(```+|~~~+)/)
    if (open && !fence) fence = open[1]
    else if (fence && line.trim().startsWith(fence)) fence = null
    else if (fence) return line
    if (open) return line
    // Inline code keeps its text; links elsewhere point at the site or GitHub
    return line
      .split(/(`[^`]*`)/)
      .map((part, i) => (i % 2 ? part : part.replace(/\]\(([^)\s]+)\)/g, (_, href) => `](${resolveLink(doc.file, href)})`)))
      .join('')
  })
  const front = [
    '---',
    `# Generated from ${doc.file} by site/scripts/sync-docs.mjs: edit that file instead.`,
    `title: ${JSON.stringify(title)}`,
    `editUrl: ${JSON.stringify(`${REPO}/edit/main/${doc.file}`)}`,
    ...(doc.label ? ['sidebar:', `  label: ${JSON.stringify(doc.label)}`] : []),
    '---',
  ]
  return { title, text: `${front.join('\n')}\n\n${body.join('\n').replace(/^\n+/, '')}` }
}

/** Where a doc's page goes under site/src/content/docs. */
export const pagePath = (doc) => `${doc.route.slice(1)}${doc.route === '/docs' ? '/index' : ''}.md`
