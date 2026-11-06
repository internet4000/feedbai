// The feedbai website: Starlight for the docs (synced from the repo's Markdown, see docs.mjs),
// Astro pages for the home tabs (src/pages). Built to site/dist, served by the hub Worker (../wrangler.jsonc).
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import mermaid from 'astro-mermaid'
import starlightLinksValidator from 'starlight-links-validator'
import { DOCS, REPO } from './docs.mjs'

const groups = [...new Set(DOCS.map((d) => d.group))]

export default defineConfig({
  site: 'https://feedbai.internet4000.com',
  // The home page used to have one tab per way to use feedbai; their links still work
  redirects: { '/button': '/docs/button/', '/agent': '/docs/agents/', '/diy': '/docs/on-your-own/', '/self-host': '/docs/hub/', '/give': '/feedback/' },
  integrations: [
    // Draws ```mermaid blocks in the browser, from our own bundle (no CDN)
    mermaid({ theme: 'neutral', autoTheme: true }),
    starlight({
      title: 'feedbai',
      description: 'User feedback from chat and social, straight into your GitHub issues, for you and your AI agents.',
      logo: { src: './public/favicon.svg' },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: REPO }],
      customCss: ['./src/styles/theme.css'],
      // We use our own feedback button (public/embed.js): feedback on any page reaches this repo
      head: [{ tag: 'script', attrs: { type: 'module', src: '/embed.js', 'data-project': REPO, 'data-matrix': '#feedbai:matrix.org', 'data-bluesky': '#feedbai' } }],
      lastUpdated: false,
      // Start open; the reference and project pages fold away until needed
      sidebar: groups.map((label) => ({
        label,
        collapsed: label !== 'Start',
        items: DOCS.filter((d) => d.group === label).map((d) => ({ slug: d.route.slice(1), ...(d.label ? { label: d.label } : {}) })),
      })),
      // Every link and #anchor between pages must exist, or the build fails
      plugins: [starlightLinksValidator({ errorOnLocalLinks: false, exclude: ['/', '/#start', '/feedback'] })],
    }),
  ],
})
