import {IMAGE_SIZE_CONFIG_2K_1MB} from '#/lib/constants'
import {downloadAndResize} from '#/lib/media/manip'
import {type ComposerImage, createComposerImage} from '#/state/gallery'

/**
 * The card thumbnail for a tile, from its screenshot. On native the screenshot
 * is used as is; the web build composites a play button on top of it (see
 * `thumb.web.ts`), which is what other clients then show for the card.
 */
export async function makeTileThumb(
  screenshotUrl: string,
): Promise<ComposerImage | undefined> {
  try {
    const image = await downloadAndResize({
      uri: screenshotUrl,
      ...IMAGE_SIZE_CONFIG_2K_1MB,
      timeout: 15e3,
    })
    if (image) {
      return await createComposerImage(image)
    }
  } catch {}
  return undefined
}
