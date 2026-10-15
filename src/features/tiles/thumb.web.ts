import {IMAGE_SIZE_CONFIG_2K_1MB} from '#/lib/constants'
import {downloadAndResize} from '#/lib/media/manip'
import {blobToDataUri} from '#/lib/media/util'
import {type ComposerImage, createComposerImage} from '#/state/gallery'

/**
 * The card thumbnail for a tile: its screenshot with a translucent play button
 * composited on top, so that the card reads as playable wherever it is shown,
 * including in clients that know nothing about tiles.
 */
export async function makeTileThumb(
  screenshotUrl: string,
): Promise<ComposerImage | undefined> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15e3)
    const res = await fetch(screenshotUrl, {signal: controller.signal})
    clearTimeout(timeout)
    if (!res.ok) return undefined
    /*
     * Going through a data URI keeps the canvas untainted: the screenshot
     * comes from the author's PDS, another origin.
     */
    const screenshot = await blobToDataUri(await res.blob())
    const composed = await drawPlayButton(screenshot)
    const image = await downloadAndResize({
      uri: composed,
      ...IMAGE_SIZE_CONFIG_2K_1MB,
      timeout: 15e3,
    })
    if (image) {
      return await createComposerImage(image)
    }
  } catch {}
  return undefined
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Draws a translucent play button over the middle of an image and returns the
 * result as a PNG data URI (the thumbnail pipeline re-encodes it anyway).
 */
export async function drawPlayButton(dataUri: string): Promise<string> {
  const img = await loadImage(dataUri)
  const width = img.naturalWidth
  const height = img.naturalHeight
  if (!width || !height) return dataUri
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUri
  ctx.drawImage(img, 0, 0)

  const cx = width / 2
  const cy = height / 2
  const radius = Math.min(width, height) * 0.14

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = Math.max(2, radius * 0.07)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.stroke()

  // A right-pointing triangle, nudged right so it looks centered.
  const half = radius * 0.5
  const left = cx - half * 0.8
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.beginPath()
  ctx.moveTo(left, cy - half)
  ctx.lineTo(left, cy + half)
  ctx.lineTo(cx + half * 1.05, cy)
  ctx.closePath()
  ctx.fill()

  return canvas.toDataURL('image/png')
}
