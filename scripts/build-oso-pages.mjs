/**
 * Build Oso's static pages (FAQ, ...) as plain HTML, readable without the app.
 *
 * Each page is a pair of Markdown files in brands/oso/pages/content/
 * (`<page>.en.md`, `<page>.nl.md`), rendered into one HTML file that holds
 * both languages and shows the reader's. The output goes to
 * `<outDir>/about/<page>.html`, next to the app's build. As real files they
 * are served by the CDN directly, without the app; the app in turn opens
 * links under /about/ as web pages (see isBskyAppUrl).
 *
 *   node scripts/build-oso-pages.mjs web-build
 *
 * The Markdown supports only what the pages use: `##` sections and `###`
 * entries (both in the index), `####` subheadings, paragraphs, `- `, `1. `
 * and `a. ` lists, `[text](url)` links, `**bold**` and `*italic*`, with
 * `\*` for a literal asterisk (as in `app.bsky.\*`).
 * A heading can set its own anchor with `{#id}` at the end, and
 * `[text](#id)` links to it within the same language. The build fails on a
 * link to an anchor that does not exist.
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const PAGES_DIR = path.join(ROOT, 'brands/oso/pages')
const CONTENT_DIR = path.join(PAGES_DIR, 'content')
const LANGS = ['en', 'nl']
/** Accessible name of each language's index. */
const TOC_LABELS = {en: 'Contents', nl: 'Inhoud'}

const outDir = process.argv[2]
if (!outDir) {
  console.error('Usage: node scripts/build-oso-pages.mjs <outDir>')
  process.exit(1)
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Lowercase, accent-free id for an anchor, unique within `used`. */
function slugify(text, prefix, used) {
  const base =
    prefix +
    '-' +
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60)
  let id = base
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`
  used.add(id)
  return id
}

function safeUrl(url) {
  return /^(https?:|mailto:|\/|#)/.test(url) ? url : '#'
}

/**
 * Render inline Markdown. Anchor links get the language prefix and are noted
 * in `anchors`, when given, to be checked once the page is rendered.
 */
function inline(text, lang, anchors) {
  /*
   * A `\*` is held back as a control character so the bold and italic rules
   * skip it, then put back as a plain asterisk.
   */
  return escapeHtml(text.replace(/\\\*/g, '\u0001'))
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
      if (url.startsWith('#') && lang) {
        url = `#${lang}-${url.slice(1)}`
        anchors?.push(url.slice(1))
      }
      return `<a href="${safeUrl(url)}">${label}</a>`
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?=[^*\w]|$)/g, '$1<em>$2</em>')
    .replace(/\u0001/g, '*')
}

/** List markers: `- ` bullets, `1. ` numbers and `a. ` letters. */
const LIST_ITEM = /^(?:(-)|(\d+)\.|([a-z])\.) (.+)/
const LIST_TAGS = {
  bullet: ['<ul>', '</ul>'],
  number: ['<ol>', '</ol>'],
  letter: ['<ol type="a">', '</ol>'],
}

/** Split `Heading text {#id}` into its text and the anchor it asks for. */
function heading(text, lang, used) {
  const match = text.match(/^(.*?)\s*\{#([a-z0-9-]+)\}$/)
  if (!match) return {text, id: slugify(text, lang, used)}
  const id = `${lang}-${match[2]}`
  if (used.has(id)) throw new Error(`Anchor {#${match[2]}} is used twice`)
  used.add(id)
  return {text: match[1], id}
}

function parseFrontMatter(source, file) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) throw new Error(`${file}: missing front matter`)
  const meta = Object.fromEntries(
    match[1].split('\n').map(line => {
      const i = line.indexOf(':')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    }),
  )
  if (!meta.title) throw new Error(`${file}: front matter needs a title`)
  return {meta, body: source.slice(match[0].length)}
}

/** Render a page's Markdown to its body HTML and its contents list. */
function render(body, lang) {
  const used = new Set()
  const anchors = []
  const html = []
  const toc = []
  let paragraph = []
  let list = []
  let listKind = 'bullet'
  /** Number of a numbered list's first item, for a list that resumes. */
  let listStart = 1

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(' '), lang, anchors)}</p>`)
      paragraph = []
    }
  }
  const flushList = () => {
    if (list.length) {
      let [open, close] = LIST_TAGS[listKind]
      if (listKind === 'number' && listStart !== 1) {
        open = `<ol start="${listStart}">`
      }
      html.push(
        open +
          list.map(item => `<li>${inline(item, lang, anchors)}</li>`).join('') +
          close,
      )
      list = []
    }
  }
  const flush = () => {
    flushParagraph()
    flushList()
  }
  for (const raw of body.split('\n')) {
    const line = raw.trim()
    let match
    if (!line) {
      flush()
    } else if ((match = line.match(/^## (.+)/))) {
      flush()
      const {text, id} = heading(match[1], lang, used)
      html.push(`<h2 id="${id}">${inline(text)}</h2>`)
      toc.push({id, text, questions: []})
    } else if ((match = line.match(/^### (.+)/))) {
      flush()
      const {text, id} = heading(match[1], lang, used)
      html.push(`<h3 id="${id}">${inline(text)}</h3>`)
      toc.at(-1)?.questions.push({id, text})
    } else if ((match = line.match(/^#### (.+)/))) {
      flush()
      const {text, id} = heading(match[1], lang, used)
      html.push(`<h4 id="${id}">${inline(text)}</h4>`)
    } else if ((match = line.match(LIST_ITEM))) {
      flushParagraph()
      const kind = match[1] ? 'bullet' : match[2] ? 'number' : 'letter'
      // A new kind of marker starts a new list.
      if (list.length && kind !== listKind) flushList()
      if (!list.length) listStart = Number(match[2] ?? 1)
      listKind = kind
      list.push(match[4])
    } else {
      if (list.length) flush()
      paragraph.push(line)
    }
  }
  flush()

  for (const anchor of anchors) {
    if (!used.has(anchor)) {
      throw new Error(
        `Link to #${anchor.slice(lang.length + 1)} (${lang}) has no matching heading`,
      )
    }
  }

  // A page without sections (a placeholder, say) gets no index.
  if (toc.length === 0) return {html: html.join('\n'), toc: ''}

  const tocHtml =
    `<nav class="toc" aria-label="${TOC_LABELS[lang]}"><ol>` +
    toc
      .map(
        section =>
          `<li><span>${inline(section.text)}</span>` +
          (section.questions.length
            ? '<ol>' +
              section.questions
                .map(q => `<li><a href="#${q.id}">${inline(q.text)}</a></li>`)
                .join('') +
              '</ol>'
            : '') +
          '</li>',
      )
      .join('') +
    '</ol></nav>\n<hr />'

  return {html: html.join('\n'), toc: tocHtml}
}

const template = fs.readFileSync(path.join(PAGES_DIR, 'template.html'), 'utf8')
const css = fs.readFileSync(path.join(PAGES_DIR, 'pages.css'), 'utf8')
const logo = fs
  .readFileSync(path.join(ROOT, 'assets/brand/mark.svg'), 'utf8')
  .replace(/<svg /, '<svg aria-hidden="true" focusable="false" ')
/*
 * The round logo fills the whole square, so it stays readable as a tab icon;
 * the app's PNG favicons are cut down from the padded app icon and blur.
 */
const favicon =
  'data:image/svg+xml;base64,' +
  fs.readFileSync(path.join(ROOT, 'assets/brand/hero.svg')).toString('base64')

const pages = [
  ...new Set(
    fs
      .readdirSync(CONTENT_DIR)
      .filter(file => file.endsWith('.md'))
      .map(file => file.split('.')[0]),
  ),
]

for (const page of pages) {
  const values = {css, logo, favicon}
  const titles = {}
  for (const lang of LANGS) {
    const file = path.join(CONTENT_DIR, `${page}.${lang}.md`)
    if (!fs.existsSync(file)) throw new Error(`Missing ${file}`)
    const {meta, body} = parseFrontMatter(fs.readFileSync(file, 'utf8'), file)
    const {html, toc} = render(body, lang)
    const Lang = lang[0].toUpperCase() + lang.slice(1)
    titles[lang] = `${meta.title} – oso`
    values[`title${Lang}`] = escapeHtml(meta.title)
    values[`toc${Lang}`] = toc
    values[`body${Lang}`] = html
  }
  // `<` is escaped so a title can never close the script it sits in.
  values.titlesJson = JSON.stringify(titles).replace(/</g, '\\u003c')

  const output = template.replace(/\{\{(\w+)\}\}/g, (whole, key) => {
    if (!(key in values)) throw new Error(`Unknown placeholder ${whole}`)
    return values[key]
  })
  const target = path.join(outDir, 'about', `${page}.html`)
  fs.mkdirSync(path.dirname(target), {recursive: true})
  fs.writeFileSync(target, output)
  console.log(`wrote ${path.relative(process.cwd(), target)}`)
}
