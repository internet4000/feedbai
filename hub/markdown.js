/**
 * A small Markdown renderer for the docs in this repo (no dependencies): headings with GitHub-style ids,
 * paragraphs, lists (nested, with code inside), fenced code (``` mermaid becomes a diagram), tables,
 * blockquotes, rules; inline code, links, bold, italic, bare URLs. Raw HTML is always escaped.
 * `link(href)` rewrites every link target (the site maps repo paths to its own routes).
 */
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/** GitHub's heading anchors: lowercase, punctuation dropped, spaces to dashes. */
export const slug = (text) =>
  text
    .replace(/`|\*\*|\[([^\]]*)\]\([^)]*\)/g, '$1')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s/g, '-')

export const inline = (text, link = (href) => href) => {
  const codes = []
  let out = text.replace(/\\\|/g, '|').replace(/`([^`]+)`/g, (_, code) => `\u0000${codes.push(code) - 1}\u0000`)
  out = esc(out)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${esc(link(href.replace(/&amp;/g, '&')))}">${label}</a>`)
    .replace(/(?<![="'>/])\bhttps?:\/\/[^\s<*]+[^\s<*.,;:!?)]/g, (url) => `<a href="${url}">${url}</a>`)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])[_*]([^_*\s][^_*]*?)[_*](?=[\s).,:;!?]|$)/g, '$1<em>$2</em>')
    .replace(/ {2,}$|\\$/gm, '<br>')
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`)
}

const LIST = /^( *)([-*+]|\d+\.) +/
const FENCE = /^ *(```+|~~~+)\s*([\w-]*)/
const startsBlock = (line) => /^#{1,6} /.test(line) || LIST.test(line) || FENCE.test(line) || /^>/.test(line) || /^\|/.test(line)
const cells = (row) => row.replace(/\\\|/g, '\u0001').trim().replace(/^\||\|$/g, '').split('|').map((c) => c.replace(/\u0001/g, '\\|').trim())

/** Returns { html, title, headings, mermaid }. */
export const render = (markdown, { link } = {}) => {
  const ids = new Map()
  const doc = { title: '', headings: [], mermaid: false }
  const blocks = (lines) => {
    const out = []
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      if (!line.trim()) { i++; continue }
      const fence = line.match(FENCE)
      if (fence) {
        const indent = line.match(/^ */)[0].length
        const body = []
        for (i++; i < lines.length && !lines[i].trim().startsWith(fence[1]); i++) body.push(lines[i].slice(Math.min(indent, lines[i].match(/^ */)[0].length)))
        i++
        const code = esc(body.join('\n'))
        if (fence[2] === 'mermaid') { doc.mermaid = true; out.push(`<pre class="mermaid">${code}</pre>`) }
        else out.push(`<pre${fence[2] ? ` data-lang="${esc(fence[2])}"` : ''}><code>${code}</code></pre>`)
        continue
      }
      const heading = line.match(/^(#{1,6}) +(.*?)(?: +#+)? *$/)
      if (heading) {
        const level = heading[1].length
        const base = slug(heading[2])
        const n = ids.get(base) ?? 0
        ids.set(base, n + 1)
        const id = n ? `${base}-${n}` : base
        if (level === 1 && !doc.title) doc.title = heading[2].replace(/`/g, '')
        else doc.headings.push({ level, id, text: heading[2] })
        out.push(`<h${level} id="${esc(id)}">${inline(heading[2], link)}${level > 1 ? ` <a class="anchor" href="#${esc(id)}" aria-label="Link to this section">#</a>` : ''}</h${level}>`)
        i++
        continue
      }
      if (/^ *([-*_]) *(\1 *){2,}$/.test(line)) { out.push('<hr>'); i++; continue }
      if (/^>/.test(line)) {
        const quote = []
        for (; i < lines.length && /^>/.test(lines[i]); i++) quote.push(lines[i].replace(/^> ?/, ''))
        out.push(`<blockquote>${blocks(quote)}</blockquote>`)
        continue
      }
      if (/^\|/.test(line) && /^\|? *:?-+/.test(lines[i + 1] ?? '')) {
        const head = cells(line)
        const align = cells(lines[i + 1]).map((c) => (c.endsWith(':') ? (c.startsWith(':') ? 'center' : 'right') : ''))
        const td = (tag, c, j) => `<${tag}${align[j] ? ` style="text-align:${align[j]}"` : ''}>${inline(c, link)}</${tag}>`
        const rows = []
        for (i += 2; i < lines.length && /^\|/.test(lines[i]); i++) rows.push(`<tr>${cells(lines[i]).map((c, j) => td('td', c, j)).join('')}</tr>`)
        out.push(`<div class="table"><table><thead><tr>${head.map((c, j) => td('th', c, j)).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`)
        continue
      }
      const item = line.match(LIST)
      if (item) {
        const ordered = /\d/.test(item[2])
        const start = ordered && item[2] !== '1.' ? ` start="${parseInt(item[2])}"` : ''
        const items = []
        while (i < lines.length) {
          const m = lines[i].match(LIST)
          if (!m || m[1].length !== item[1].length || /\d/.test(m[2]) !== ordered) break
          const width = m[0].length
          const body = [lines[i].slice(width)]
          let loose = false
          for (i++; i < lines.length; i++) {
            const next = lines[i]
            if (!next.trim()) {
              const after = lines.slice(i + 1).find((l) => l.trim())
              if (after === undefined || after.match(/^ */)[0].length < width) break
              loose = true
              body.push('')
              continue
            }
            const indent = next.match(/^ */)[0].length
            if (indent >= Math.min(width, item[1].length + 2)) body.push(next.slice(Math.min(indent, width)))
            else if (!startsBlock(next) && body.at(-1) !== '') body.push(next.trim()) // lazy continuation
            else break
          }
          let html = blocks(body)
          if (!loose) html = html.replace(/^<p>([\s\S]*?)<\/p>/, '$1')
          items.push(`<li>${html}</li>`)
          while (i < lines.length && !lines[i].trim()) {
            const after = lines.slice(i + 1).find((l) => l.trim())
            if (!after?.match(LIST) || after.match(LIST)[1].length !== item[1].length) break
            i++
          }
        }
        out.push(ordered ? `<ol${start}>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`)
        continue
      }
      const para = []
      for (; i < lines.length && lines[i].trim() && !(para.length && startsBlock(lines[i])); i++) para.push(lines[i].replace(/^ +/, ''))
      out.push(`<p>${inline(para.join('\n'), link)}</p>`)
    }
    return out.join('\n')
  }
  const html = blocks(markdown.replace(/\r\n?/g, '\n').split('\n'))
  return { ...doc, html }
}
