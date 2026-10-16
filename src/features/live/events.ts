import {
  type EmbedPlayerParams,
  parseEmbedPlayerFromUrl,
} from '#/lib/strings/embed-player'
import {postUrls} from '#/features/newsrooms/postLinks'
import {type app, type social} from '#/lexicons'

/**
 * The account that curates the Live section. It posts each stream (that
 * post anchors the live thread) and holds one `social.mu.live.event` record
 * per broadcast; mu lists that collection straight from its repo.
 */
export const LIVE_CURATOR_HANDLE = 'liveonmu.eurosky.social'
export const LIVE_EVENT_NSID = 'social.mu.live.event'

/**
 * The list of accounts whose stream posts appear in the Live section, kept
 * by the mu.social account. Membership is read from that account's repo.
 */
export const LIVE_SOURCES_LIST_URI =
  'at://did:plc:fivmz34azxgjafrk6ogns7k5/app.bsky.graph.list/3mup7zx7bd42o'

/** A curated live event, as the app uses it: the record plus its address. */
export interface LiveEvent {
  /** The record key; also the id in `/live/:id`. */
  id: string
  /** The record's at-uri. */
  uri: string
  title: string
  description?: string
  /** The account whose post anchors the live thread. */
  hostDid: string
  /** Where the video streams. Must parse to an inline player. */
  streamUrl: string
  /** Explicit anchor post; otherwise resolved by search. */
  anchorPostUri?: string
  startsAt: string
  endsAt?: string
  image?: string
  accent?: string
  speakerDids?: string[]
  runningOrder?: {at: string; label: string}[]
  /**
   * Other ids this event answers to: the post rkeys of curator posts for the
   * same stream that a record superseded, so shared links keep working.
   */
  aliasIds?: string[]
  /** Whether the event comes from a record (else from a curator post). */
  fromRecord?: boolean
}

export type LiveEventState = 'upcoming' | 'live' | 'ended'

/** Maps a `social.mu.live.event` record to the app's shape. */
export function liveEventFromRecord(
  uri: string,
  record: social.mu.live.event.Main,
): LiveEvent {
  const rkey = uri.split('/').pop() ?? uri
  return {
    id: rkey,
    uri,
    title: record.title,
    description: record.description,
    hostDid: record.host,
    streamUrl: record.streamUrl,
    anchorPostUri: record.anchorPost,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    image: record.image,
    accent: record.accent,
    speakerDids: record.speakers,
    runningOrder: record.runningOrder,
  }
}

/** Player types that play inline in mu. Anything else is a link card. */
const PLAYABLE_TYPES = new Set<EmbedPlayerParams['type']>([
  'youtube_video',
  'twitch_video',
  'vimeo_video',
  'streamplace_live',
])

export function getLiveEventState(
  event: LiveEvent,
  now: number = Date.now(),
): LiveEventState {
  const start = new Date(event.startsAt).getTime()
  if (now < start) return 'upcoming'
  if (event.endsAt && now >= new Date(event.endsAt).getTime()) return 'ended'
  return 'live'
}

/**
 * The inline player for a stream link, or undefined when the host does not
 * play inline. Used both to render and to validate the editor form.
 */
export function getStreamPlayer(
  streamUrl: string,
): EmbedPlayerParams | undefined {
  let params: EmbedPlayerParams | undefined
  try {
    params = parseEmbedPlayerFromUrl(streamUrl)
  } catch {
    return undefined
  }
  if (!params || !PLAYABLE_TYPES.has(params.type)) return undefined
  return params
}

/** The hero image: the record image, else YouTube's own thumbnail. */
export function getLiveEventThumb(event: LiveEvent): string | undefined {
  if (event.image) return event.image
  const key = streamKey(event.streamUrl)
  if (key?.startsWith('youtube:')) {
    return `https://i.ytimg.com/vi/${key.slice('youtube:'.length)}/hqdefault.jpg`
  }
  return undefined
}

/**
 * A canonical key for a stream URL, so the different ways people paste the
 * same stream compare equal: `youtube:<id>`, `twitch:<channel>`, otherwise
 * the normalized host and path.
 */
export function streamKey(url: string): string | undefined {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return undefined
  }
  const host = u.hostname.replace(/^www\.|^m\.|^music\./, '').toLowerCase()
  const segments = u.pathname.split('/').filter(Boolean)

  if (host === 'youtu.be') {
    return segments[0] ? `youtube:${segments[0]}` : undefined
  }
  if (host === 'youtube.com') {
    const [page, id] = segments
    if ((page === 'live' || page === 'shorts' || page === 'embed') && id) {
      return `youtube:${id}`
    }
    const v = u.searchParams.get('v')
    return v ? `youtube:${v}` : undefined
  }
  if (host === 'twitch.tv') {
    const [first, second, third] = segments
    if (first === 'videos' && second) return `twitch:video:${second}`
    if (second === 'clip' && third) return `twitch:clip:${third}`
    return first ? `twitch:${first.toLowerCase()}` : undefined
  }
  if (host === 'stream.place') {
    const [first, second, third] = segments
    const handle = first === 'embed' ? second : first
    const isChannel = first === 'embed' ? !third : !second
    if (!handle || !handle.includes('.')) return undefined
    return isChannel
      ? `streamplace:${handle.toLowerCase()}`
      : `streamplace:${handle.toLowerCase()}:${segments.slice(1).join('/')}`
  }
  return host + u.pathname.replace(/\/+$/, '').toLowerCase()
}

/**
 * The URL forms a stream is commonly shared under. The appview's URL search
 * matches on the exact link, so the discussion query runs once per variant.
 */
export function streamUrlVariants(url: string): string[] {
  const key = streamKey(url)
  if (!key) return [url]
  if (key.startsWith('youtube:')) {
    const id = key.slice('youtube:'.length)
    return [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`,
      `https://www.youtube.com/live/${id}`,
      `https://m.youtube.com/watch?v=${id}`,
    ]
  }
  if (
    key.startsWith('twitch:') &&
    !key.includes(':video:') &&
    !key.includes(':clip:')
  ) {
    const channel = key.slice('twitch:'.length)
    return [
      `https://www.twitch.tv/${channel}`,
      `https://twitch.tv/${channel}`,
      `https://m.twitch.tv/${channel}`,
    ]
  }
  if (key.startsWith('streamplace:')) {
    const handle = key.slice('streamplace:'.length)
    return [
      `https://stream.place/${handle}`,
      `https://stream.place/embed/${handle}`,
    ]
  }
  return [url]
}

/**
 * A post carries no end time, so a post-derived event counts as live for
 * this long after it was posted. A record sets its own times.
 */
export const POST_EVENT_DURATION_MS = 12 * 60 * 60 * 1000

/** What a post needs to become an event, whichever way it was fetched. */
export type PostSource = {
  uri: string
  authorDid: string
  createdAt: string
  text: string
  /** The link card, when the post has one. */
  external?: {uri: string; title?: string; thumb?: string}
  /** Every link the post points at, link card included. */
  links: string[]
}

/**
 * The event a post implies, or undefined when none of its links plays
 * inline. The post is the anchor, its link-card title the event title, its
 * text the description, its author the host.
 */
export function liveEventFromPost(post: PostSource): LiveEvent | undefined {
  const streamUrl = post.links.find(u => !!getStreamPlayer(u))
  if (!streamUrl) return undefined
  const external = post.external?.uri === streamUrl ? post.external : undefined
  // Drop the link itself, including the shortened form the composer writes.
  const text = post.text
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\bwww\.\S+/gi, '')
    .trim()
  const firstLine = text.split('\n')[0]?.trim()
  const title = external?.title?.trim() || firstLine || streamUrl
  const rkey = post.uri.split('/').pop() ?? post.uri
  return {
    id: rkey,
    uri: post.uri,
    title,
    description: title === firstLine ? undefined : text || undefined,
    hostDid: post.authorDid,
    streamUrl,
    anchorPostUri: post.uri,
    startsAt: post.createdAt,
    endsAt: new Date(
      new Date(post.createdAt).getTime() + POST_EVENT_DURATION_MS,
    ).toISOString(),
    image: external?.thumb,
  }
}

/** Whether a post links the stream, under any of its URL forms. */
export function postReferencesStream(
  post: app.bsky.feed.defs.PostView,
  key: string,
): boolean {
  return postUrls(post).some(candidate => streamKey(candidate) === key)
}

/**
 * Turns a pasted post link (`/profile/<actor>/post/<rkey>` on any host) or
 * an at-uri into `{actor, rkey}`; `actor` may still be a handle.
 */
export function parsePostReference(
  input: string,
): {actor: string; rkey: string} | undefined {
  const trimmed = input.trim()
  if (!trimmed) return undefined
  const at = trimmed.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/?#]+)/)
  if (at) return {actor: at[1], rkey: at[2]}
  const web = trimmed.match(/\/profile\/([^/]+)\/post\/([^/?#]+)/)
  if (web) return {actor: decodeURIComponent(web[1]), rkey: web[2]}
  return undefined
}
