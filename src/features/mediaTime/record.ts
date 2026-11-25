import {type UriString} from '@atproto/syntax'
import {type Facet, RichText} from '@bsky/sdk/richtext'

import {postUriToRelativePath, toShareUrl} from '#/lib/strings/url-helpers'
import {app, network} from '#/lexicons'
import * as bsky from '#/types/bsky'

/**
 * Key of the extra field on `app.bsky.feed.post` records. The value follows
 * the `network.eurosky.mediaTime` lexicon, so the key and its `$type` match.
 */
export const MEDIA_TIME_FIELD = 'network.eurosky.mediaTime'

/** Upper bound for a stored or linked time: 100 hours. */
export const MAX_MEDIA_TIME_SECONDS = 100 * 60 * 60

/**
 * Text-presentation selector, so iOS and Android draw a plain triangle
 * instead of the play-button emoji.
 */
const PLAY_SYMBOL = '▶︎'

const LINK_TEXT_RE = /^▶︎? (?:\d{1,3}:)?\d{1,2}:\d{2}$/
const POST_PATH_RE =
  /^\/profile\/(did:[a-z]+:[a-zA-Z0-9._:%-]+)\/post\/([a-zA-Z0-9._~:-]{1,512})\/?$/

export type MediaTimeValue = network.eurosky.mediaTime.Main

/** A post record with the media time field set. */
export type PostRecordWithMediaTime = app.bsky.feed.post.Main & {
  [MEDIA_TIME_FIELD]?: MediaTimeValue
}

/** Whether `seconds` is a whole, non-negative time we are willing to store. */
export function isValidMediaTimeSeconds(seconds: number): boolean {
  return (
    Number.isInteger(seconds) &&
    seconds >= 0 &&
    seconds <= MAX_MEDIA_TIME_SECONDS
  )
}

/** Builds the field value for a time in seconds. */
export function createMediaTimeValue(seconds: number): MediaTimeValue {
  return {$type: MEDIA_TIME_FIELD, seconds}
}

/**
 * Reads the time a post record is linked to, or `undefined` when the record
 * has no valid media time field.
 */
export function getMediaTime(record: unknown): number | undefined {
  if (!record || typeof record !== 'object') return undefined
  const value = (record as Record<string, unknown>)[MEDIA_TIME_FIELD]
  if (!bsky.matches(network.eurosky.mediaTime, value)) return undefined
  return isValidMediaTimeSeconds(value.seconds) ? value.seconds : undefined
}

/** Formats seconds as `m:ss`, or `h:mm:ss` from one hour on. */
export function formatMediaTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = String(total % 60).padStart(2, '0')
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${secs}`
  }
  return `${minutes}:${secs}`
}

/**
 * The visible text of the time link, e.g. `▶ 0:41`. Other apps show it as a
 * link; mu renders it as a time pill.
 */
export function getMediaTimeLinkText(seconds: number): string {
  return `${PLAY_SYMBOL} ${formatMediaTime(seconds)}`
}

/**
 * Web address that opens the video post at `seconds`. Uses the post's DID so
 * the link keeps working after a handle change.
 */
export function getMediaTimeLinkUri(
  videoPostUri: string,
  seconds: number,
): string | undefined {
  const path = postUriToRelativePath(videoPostUri)
  if (!path) return undefined
  return `${toShareUrl(path)}?t=${seconds}`
}

/**
 * How many characters the time link adds to a post, including the space in
 * front of it. The composer counts these against the post length limit.
 */
export function getMediaTimeLinkGraphemes(seconds: number): number {
  return new RichText({text: ` ${getMediaTimeLinkText(seconds)}`})
    .graphemeLength
}

/**
 * Appends the time link to already resolved post text and returns the new
 * text and facets. Facet offsets are UTF-8 byte offsets, as the lexicon
 * requires.
 */
export function appendMediaTimeLink(
  richtext: {text: string; facets?: Facet[]},
  {videoPostUri, seconds}: {videoPostUri: string; seconds: number},
): {text: string; facets: Facet[] | undefined} {
  const uri = getMediaTimeLinkUri(videoPostUri, seconds)
  if (!uri) {
    return {text: richtext.text, facets: richtext.facets}
  }
  const prefix = richtext.text.length > 0 ? `${richtext.text} ` : ''
  const linkText = getMediaTimeLinkText(seconds)
  const byteStart = new RichText({text: prefix}).length
  const byteEnd = byteStart + new RichText({text: linkText}).length
  const facet: Facet = {
    index: {byteStart, byteEnd},
    features: [{$type: 'app.bsky.richtext.facet#link', uri: uri as UriString}],
  }
  return {
    text: prefix + linkText,
    facets: [...(richtext.facets ?? []), facet],
  }
}

/**
 * Recognises a time link written by {@link appendMediaTimeLink}: the visible
 * text is `▶ m:ss` and the address points at a post with a `t` parameter.
 * The host is not checked, so links written by other builds (for example a
 * partner brand on a different domain) are recognised too; mu opens them in
 * the app instead of following the address.
 */
export function parseMediaTimeLink(
  uri: string,
  text: string,
): {videoPostUri: string; seconds: number} | undefined {
  if (!LINK_TEXT_RE.test(text)) return undefined
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return undefined
  }
  if (url.protocol !== 'https:') return undefined
  const match = POST_PATH_RE.exec(url.pathname)
  if (!match) return undefined
  const seconds = parseMediaTimeParam(url.searchParams.get('t'))
  if (seconds === undefined) return undefined
  const did = decodeURIComponent(match[1])
  return {
    videoPostUri: `at://${did}/app.bsky.feed.post/${match[2]}`,
    seconds,
  }
}

/** A video post's title for a header: the first line of its text. */
export function getVideoTitle(text: string): string | undefined {
  return (
    text
      .split('\n')
      .map(line => line.trim())
      .find(line => line.length > 0) || undefined
  )
}

/**
 * `richText` without the time link at its end, and the space before it.
 * Used where the time shows next to the comment instead. Returns
 * `richText` itself when it doesn't end with one.
 */
export function withoutMediaTimeLink(richText: RichText): RichText {
  const end = richText.length
  const facet = richText.facets?.find(
    f =>
      f.index.byteEnd === end &&
      f.features.some(
        feature =>
          feature.$type === 'app.bsky.richtext.facet#link' &&
          'uri' in feature &&
          parseMediaTimeLink(
            feature.uri,
            richText.unicodeText.slice(f.index.byteStart, f.index.byteEnd),
          ) !== undefined,
      ),
  )
  if (!facet) return richText
  const before = richText.unicodeText.slice(0, facet.index.byteStart)
  const start = before.endsWith(' ')
    ? facet.index.byteStart - 1
    : facet.index.byteStart
  return richText.clone().delete(start, end)
}

/**
 * Parses a `t` route or query parameter (whole seconds). Anything else, such
 * as `1m30s` or a negative number, yields `undefined`.
 */
export function parseMediaTimeParam(
  value: string | null | undefined,
): number | undefined {
  if (!value || !/^\d{1,7}$/.test(value)) return undefined
  const seconds = Number(value)
  return isValidMediaTimeSeconds(seconds) ? seconds : undefined
}

/**
 * The video embed that belongs to a post itself (not to a post it quotes), or
 * `undefined`. Only replies to such posts can be linked to a second.
 */
export function getOwnVideoEmbed(
  embed: app.bsky.feed.defs.PostView['embed'] | undefined,
): app.bsky.embed.video.View | undefined {
  if (bsky.isType(app.bsky.embed.video.view, embed)) return embed
  if (
    bsky.isType(app.bsky.embed.recordWithMedia.view, embed) &&
    bsky.isType(app.bsky.embed.video.view, embed.media)
  ) {
    return embed.media
  }
  return undefined
}
