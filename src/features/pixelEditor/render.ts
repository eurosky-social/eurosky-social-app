import {encode} from 'upng-js'

import {type Drawing} from '#/features/pixelEditor/model'
import {loadPhotoPixels} from '#/features/pixelEditor/photoPixels'

export const DRAWING_IMAGE_SIZE = 512

/** Flatten onto the original square photo; never silently omit a failed photo load. */
export async function renderDrawing(drawing: Drawing, avatar?: string) {
  const size = DRAWING_IMAGE_SIZE
  const photo = avatar ? await loadPhotoPixels(avatar, size) : undefined
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4
      const pixel =
        drawing.pixels[
          Math.floor((y * drawing.gridSize) / size) * drawing.gridSize +
            Math.floor((x * drawing.gridSize) / size)
        ]
      const color = pixel >= 0 ? drawing.palette[pixel] : undefined
      for (let channel = 0; channel < 3; channel++) {
        data[offset + channel] = color
          ? parseInt(color.slice(1 + channel * 2, 3 + channel * 2), 16)
          : photo
            ? photo.data[offset + channel]
            : 230
      }
      data[offset + 3] = color ? 255 : photo ? photo.data[offset + 3] : 255
    }
  }
  let png = encode([data.buffer], size, size, 0)
  if (png.byteLength > 1_000_000) png = encode([data.buffer], size, size, 256)
  return new Uint8Array(png)
}
