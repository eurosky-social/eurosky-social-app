import {BRAND} from '#/config/brand'
import {device} from '#/storage'

/**
 * The CDN every AppView we know of (Bluesky, Eurosky, Blacksky) puts in its
 * image URLs. Only URLs on this origin are rewritten.
 */
export const SOURCE_IMAGE_CDN = 'https://cdn.bsky.app'

export type ImageCdnPresetId = 'bluesky' | 'porxie'
export type ImageCdnOptionId = ImageCdnPresetId | 'default' | 'custom'

export const IMAGE_CDN_PRESETS: readonly {id: ImageCdnPresetId; url: string}[] =
  [
    {id: 'bluesky', url: SOURCE_IMAGE_CDN},
    {id: 'porxie', url: 'https://porxie-bsky.dollware.net'},
  ]

export type ImageCdnValidationErrorCode =
  'invalid-url' | 'https-required' | 'base-url-required' | 'unreachable'

export class ImageCdnValidationError extends Error {
  constructor(public code: ImageCdnValidationErrorCode) {
    super(code)
    this.name = 'ImageCdnValidationError'
  }
}

/**
 * Normalize a CDN base URL. A path prefix is allowed so a CDN can be served
 * from a subdirectory; the `/img/...` path is appended to it.
 */
export function normalizeImageCdnUrl(input: string): string {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new ImageCdnValidationError('invalid-url')
  }

  const isLocalhost = url.hostname === 'localhost'
  if (url.protocol !== 'https:' && !(isLocalhost && url.protocol === 'http:')) {
    throw new ImageCdnValidationError('https-required')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new ImageCdnValidationError('base-url-required')
  }

  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
}

function normalizeOrUndefined(input: string | undefined): string | undefined {
  if (!input) return undefined
  try {
    return normalizeImageCdnUrl(input)
  } catch {
    return undefined
  }
}

/** The build-time default (`EXPO_PUBLIC_IMAGE_CDN_URL` or brand.json). */
export function getConfiguredImageCdn(): string {
  return normalizeOrUndefined(BRAND.services.cdn) ?? SOURCE_IMAGE_CDN
}

export function readImageCdnOverride(): string | undefined {
  return normalizeOrUndefined(device.get(['imageCdnOverride']))
}

/** The CDN images should currently load from. */
export function getImageCdn(): string {
  return readImageCdnOverride() ?? getConfiguredImageCdn()
}

export function getImageCdnOptionId(url: string): ImageCdnOptionId {
  const preset = IMAGE_CDN_PRESETS.find(p => p.url === url)
  if (preset) return preset.id
  return url === getConfiguredImageCdn() ? 'default' : 'custom'
}

/** Point a single image URL at the selected CDN. Other URLs pass through. */
export function rewriteImageCdnUrl(url: string, cdn = getImageCdn()): string {
  if (cdn === SOURCE_IMAGE_CDN) return url
  return url.startsWith(`${SOURCE_IMAGE_CDN}/img/`)
    ? cdn + url.slice(SOURCE_IMAGE_CDN.length)
    : url
}

/*
 * Image URL fields in app.bsky/chat.bsky views (string, format: uri). Matching
 * on the key keeps free text such as post bodies untouched, which matters
 * because facets index into it by byte offset.
 */
const IMAGE_URL_KEYS = [
  'avatar',
  'banner',
  'thumb',
  'fullsize',
  'thumbnail',
  'image',
  'icon',
  'logo',
  'backgroundImage',
]
const IMAGE_URL_PATTERN = new RegExp(
  `("(?:${IMAGE_URL_KEYS.join('|')})"\\s*:\\s*")${SOURCE_IMAGE_CDN.replace(
    /\./g,
    '\\.',
  )}(?=/img/)`,
  'g',
)

/** Rewrite CDN image URLs inside a raw JSON response body. */
export function rewriteImageCdnUrlsInJson(json: string, cdn: string): string {
  if (cdn === SOURCE_IMAGE_CDN) return json
  return json.replace(IMAGE_URL_PATTERN, (_, prefix: string) => prefix + cdn)
}
