import * as FileSystem from 'expo-file-system/legacy'
import {Image} from 'expo-image'
import {ImageManipulator, SaveFormat} from 'expo-image-manipulator'
import {fromBase64} from '@atproto/lex'
import {decode, toRGBA8} from 'upng-js'

import {GRID_SIZE} from '#/features/halloween/costumes/model'
import {type PhotoPixels} from '#/features/halloween/costumes/photoPixels/types'

/** Decode only a tiny, locally resized PNG; never retain the original photo bytes. */
export async function loadPhotoPixels(
  uri: string,
  size = GRID_SIZE,
): Promise<PhotoPixels> {
  const image = await Image.loadAsync(uri)
  let context: ReturnType<typeof ImageManipulator.manipulate> | undefined
  let savedUri: string | undefined
  try {
    context = ImageManipulator.manipulate(image)
    const width = image.width * image.scale
    const height = image.height * image.scale
    const side = Math.min(width, height)
    context
      .crop({
        originX: Math.floor((width - side) / 2),
        originY: Math.floor((height - side) / 2),
        width: side,
        height: side,
      })
      .resize({width: size, height: size})
    const rendered = await context.renderAsync()
    try {
      const saved = await rendered.saveAsync({
        format: SaveFormat.PNG,
        base64: true,
      })
      savedUri = saved.uri
      if (!saved.base64) throw new Error('Photo pixels are unavailable')
      const png = decode(Uint8Array.from(fromBase64(saved.base64)).buffer)
      if (png.width !== size || png.height !== size)
        throw new Error('Unexpected photo dimensions')
      return {
        width: size,
        height: size,
        data: new Uint8Array(toRGBA8(png)[0]),
      }
    } finally {
      rendered.release()
    }
  } finally {
    context?.release()
    image.release()
    if (savedUri) {
      try {
        await FileSystem.deleteAsync(savedUri, {idempotent: true})
      } catch {}
    }
  }
}
