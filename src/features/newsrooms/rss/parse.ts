import {type RssItem} from './types'

/**
 * A small, dependency-free RSS 2.0 / Atom parser. React Native has no DOMParser
 * and the app ships no XML library, so we extract just the handful of fields the
 * front page needs with tolerant regex matching. This is not a general-purpose
 * XML parser - it targets well-formed news feeds and degrades to skipping any
 * item it cannot read rather than throwing.
 */
export function parseRssFeed(xml: string): RssItem[] {
  const blocks = matchAll(xml, /<(item|entry)\b[\s\S]*?<\/\1>/gi)
  const items: RssItem[] = []

  for (const block of blocks) {
    const isAtom = /^<entry/i.test(block)
    const link = isAtom ? atomLink(block) : tag(block, 'link')
    const title = clean(tag(block, 'title'))
    if (!link || !title) continue

    const guid = tag(block, 'guid') || tag(block, 'id')
    const rawDate =
      tag(block, 'pubDate') ||
      tag(block, 'published') ||
      tag(block, 'updated') ||
      tag(block, 'dc:date')
    const summary =
      tag(block, 'description') ||
      tag(block, 'summary') ||
      tag(block, 'content') ||
      tag(block, 'content:encoded')

    items.push({
      id: guid || link,
      title,
      link,
      publishedAt: toIso(rawDate),
      description: stripHtml(summary) || undefined,
      imageUrl: extractImage(block, summary),
    })
  }

  return items
}

/**
 * Pull the article's social-share image (`og:image`, falling back to
 * `twitter:image`) from its HTML. Feed `media:content` thumbnails are small and
 * look soft at hero size; the OG image is the full-resolution master. Reads only
 * the head, where these tags live, and tolerates either meta attribute order.
 */
export function extractOgImage(html: string): string | undefined {
  const head = html.slice(0, 150000)
  const metas = matchAll(head, /<meta\b[^>]*>/gi)
  let og: string | undefined
  let twitter: string | undefined

  for (const meta of metas) {
    const key = (
      meta.match(/(?:property|name)=["']([^"']+)["']/i)?.[1] || ''
    ).toLowerCase()
    const content = meta.match(/content=["']([^"']+)["']/i)?.[1]
    if (!content) continue
    if (!og && (key === 'og:image' || key === 'og:image:secure_url')) {
      og = content
    } else if (
      !twitter &&
      (key === 'twitter:image' || key === 'twitter:image:src')
    ) {
      twitter = content
    }
  }

  const url = og || twitter
  return url ? decodeEntities(url) : undefined
}

function matchAll(input: string, re: RegExp): string[] {
  return input.match(re) ?? []
}

/** Inner text of the first `<name>...</name>`, CDATA unwrapped, not yet entity-decoded. */
function tag(block: string, name: string): string {
  const re = new RegExp(
    `<${escapeName(name)}[^>]*>([\\s\\S]*?)<\\/${escapeName(name)}>`,
    'i',
  )
  const m = block.match(re)
  if (!m) return ''
  return unwrapCdata(m[1]).trim()
}

/** Atom links live in attributes; prefer rel="alternate", else the first href. */
function atomLink(block: string): string {
  const links = matchAll(block, /<link\b[^>]*>/gi)
  const alternate = links.find(l => /rel=["']alternate["']/i.test(l))
  const chosen =
    alternate || links.find(l => !/rel=/i.test(l)) || links[0] || ''
  const href = chosen.match(/href=["']([^"']+)["']/i)
  return href ? decodeEntities(href[1].trim()) : ''
}

/** Pull a lead image from enclosure / media:* tags, or the first <img> in the body. */
function extractImage(block: string, summary: string): string | undefined {
  const enclosure = block.match(
    /<enclosure\b[^>]*url=["']([^"']+)["'][^>]*type=["']image\/[^"']*["']/i,
  )
  if (enclosure) return decodeEntities(enclosure[1])

  const media = block.match(
    /<media:(?:content|thumbnail)\b[^>]*url=["']([^"']+)["']/i,
  )
  if (media) return decodeEntities(media[1])

  const img = (block + summary).match(/<img\b[^>]*src=["']([^"']+)["']/i)
  if (img) return decodeEntities(img[1])

  return undefined
}

function unwrapCdata(value: string): string {
  const m = value.match(/<!\[CDATA\[([\s\S]*?)\]\]>/)
  return m ? m[1] : value
}

function clean(value: string): string {
  return decodeEntities(unwrapCdata(value)).trim()
}

function stripHtml(value: string): string {
  // Decode first: feeds often entity-encode their markup (e.g. `&lt;p&gt;`), so
  // tags only become strippable after decoding. Stripping first would leave the
  // decoded tags behind as visible text.
  return decodeEntities(unwrapCdata(value))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function toIso(rawDate: string): string | undefined {
  if (!rawDate) return undefined
  const ms = Date.parse(rawDate)
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString()
}

function escapeName(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
