import {Image} from 'expo-image'

import {ImageCdnValidationError, SOURCE_IMAGE_CDN} from './config'

/**
 * Verify a CDN by loading a known image through it. Uses the image loader
 * rather than fetch so CDNs without CORS headers still pass on web.
 */
export async function verifyImageCdn(
  cdn: string,
  sampleImagePath: string,
): Promise<void> {
  if (cdn === SOURCE_IMAGE_CDN) return
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<boolean>(resolve => {
    timer = setTimeout(() => resolve(false), 10_000)
  })
  let ok = false
  try {
    ok = await Promise.race([
      Image.prefetch(cdn + sampleImagePath, 'memory'),
      timeout,
    ])
  } catch {
  } finally {
    clearTimeout(timer)
  }
  if (!ok) {
    throw new ImageCdnValidationError('unreachable')
  }
}

/**
 * The `/img/...` path of a CDN image URL, used to sample a real blob through
 * another CDN. The host is ignored: a cached URL may still point at a CDN
 * selected earlier.
 */
export function getImageCdnPath(url: string | undefined): string | undefined {
  const start = url?.indexOf('/img/', 'https://'.length) ?? -1
  return start === -1 ? undefined : url!.slice(start)
}
