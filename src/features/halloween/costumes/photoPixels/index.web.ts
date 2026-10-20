import {GRID_SIZE} from '#/features/halloween/costumes/model'
import {type PhotoPixels} from '#/features/halloween/costumes/photoPixels/types'

/** CORS failure is non-fatal: painted colors remain available to the eyedropper. */
export async function loadPhotoPixels(uri: string): Promise<PhotoPixels> {
  const image = new Image()
  image.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () =>
      reject(new Error('Could not sample the profile photo'))
    image.src = uri
  })
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = GRID_SIZE
  const context = canvas.getContext('2d', {willReadFrequently: true})
  if (!context) throw new Error('Canvas pixels are unavailable')
  const side = Math.min(image.naturalWidth, image.naturalHeight)
  context.drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    GRID_SIZE,
    GRID_SIZE,
  )
  return {
    width: GRID_SIZE,
    height: GRID_SIZE,
    data: context.getImageData(0, 0, GRID_SIZE, GRID_SIZE).data,
  }
}
