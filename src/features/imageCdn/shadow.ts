import * as env from '#/env'
import {normalizeImageCdnUrl, SOURCE_IMAGE_CDN} from './config'

export type ImageCdnShadowConfig = {
  percentage: number
  target: string
}

type ImageCdnShadowOptions = {
  config?: ImageCdnShadowConfig
  random?: () => number
  shadowFetch?: typeof fetch
}

const MAX_IN_FLIGHT = 4
const MAX_QUEUED = 50
const MAX_SEEN = 2_000
const TIMEOUT_MS = 20_000

/*
 * Images the app shows on load. Full-size post images only load in the
 * lightbox, so copying them would overstate real traffic.
 */
const IMAGE_URL_PATTERN = new RegExp(
  `${SOURCE_IMAGE_CDN.replace(/\./g, '\\.')}(/img/(?:avatar|avatar_thumbnail|banner|feed_thumbnail)/plain/[^"\\\\\\s]+)`,
  'g',
)

/** Build-time shadow target. Invalid settings disable shadowing. */
export function getImageCdnShadowConfig(): ImageCdnShadowConfig | undefined {
  if (env.IMAGE_CDN_SHADOW_PERCENTAGE <= 0) return undefined
  try {
    const target = normalizeImageCdnUrl(env.IMAGE_CDN_SHADOW_URL)
    if (target === SOURCE_IMAGE_CDN) return undefined
    return {percentage: env.IMAGE_CDN_SHADOW_PERCENTAGE, target}
  } catch {
    return undefined
  }
}

/**
 * Copies the images in a sampled share of AppView responses to a candidate
 * CDN and discards the result, to load-test it before it becomes the default.
 * Only runs while images load from the Bluesky CDN; each image is copied at
 * most once per session, a few at a time, and dropped when too many wait.
 */
export function createImageCdnShadow(options: ImageCdnShadowOptions = {}) {
  const config = options.config ?? getImageCdnShadowConfig()
  if (!config) return undefined

  const random = options.random ?? Math.random
  const shadowFetch = options.shadowFetch ?? globalThis.fetch
  const seen = new Set<string>()
  const queue: string[] = []
  let inFlight = 0

  const next = () => {
    while (inFlight < MAX_IN_FLIGHT && queue.length > 0) {
      const url = queue.shift()!
      inFlight++
      void load(url).finally(() => {
        inFlight--
        next()
      })
    }
  }

  const load = async (url: string) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await shadowFetch(url, {signal: controller.signal})
      await response.arrayBuffer()
    } catch {
      /* Shadow traffic must never affect the app. */
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    /** Whether to copy the images of the next response. */
    sample(): boolean {
      return config.percentage >= 100 || random() * 100 < config.percentage
    },
    /** Queue the images found in a raw JSON response body. */
    copy(json: string) {
      for (const [, path] of json.matchAll(IMAGE_URL_PATTERN)) {
        if (seen.has(path)) continue
        if (seen.size >= MAX_SEEN) seen.clear()
        seen.add(path)
        if (queue.length >= MAX_QUEUED) break
        queue.push(config.target + path)
      }
      next()
    },
  }
}
