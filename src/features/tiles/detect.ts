import {TILE_COLLECTION} from './constants'

const COLLECTION = TILE_COLLECTION.replace(/\./g, '\\.')

/*
 * The repo is a DID or a handle (anything without a slash or whitespace), the
 * record key any AT record key. Anchored: this one is for a whole string.
 */
const TILE_URI_RE = new RegExp(
  `^at://([^/\\s]+)/${COLLECTION}/([A-Za-z0-9._:~-]+)$`,
)

/* Unanchored, for scanning free text. Trailing punctuation is trimmed below. */
const TILE_URI_IN_TEXT_RE = new RegExp(
  `at://[^/\\s]+/${COLLECTION}/[A-Za-z0-9._:~-]+`,
  'g',
)

export type ParsedTileUri = {
  /** The at-URI, trimmed. */
  uri: string
  /** The repo part: a DID or a handle. */
  repo: string
  rkey: string
}

/** Parses `at://<repo>/ing.dasl.masl/<rkey>`; undefined for anything else. */
export function parseTileUri(input: string): ParsedTileUri | undefined {
  const match = TILE_URI_RE.exec(input.trim())
  if (!match) return undefined
  return {uri: match[0], repo: match[1], rkey: match[2]}
}

export function isTileUri(input: string): boolean {
  return parseTileUri(input) !== undefined
}

/** Every distinct tile at-URI in a piece of text, in order of appearance. */
export function findTileUris(text: string): string[] {
  const found: string[] = []
  for (const match of text.matchAll(TILE_URI_IN_TEXT_RE)) {
    const uri = match[0].replace(/[.,;:!?]+$/, '')
    if (!found.includes(uri)) found.push(uri)
  }
  return found
}
