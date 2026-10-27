import {useEffect, useState} from 'react'

import {normalizeHex} from '#/features/halloween/costumes/colors'
import {
  GRID_SIZE,
  type Point,
  validPoint,
} from '#/features/halloween/costumes/model'
import {loadPhotoPixels} from '#/features/halloween/costumes/photoPixels'
import {type PhotoPixels} from '#/features/halloween/costumes/photoPixels/types'

export function samplePhoto(
  pixels: PhotoPixels | null,
  point: Point,
  background?: string,
): string | null {
  if (!pixels || !validPoint(point)) return null
  const x = Math.min(
    pixels.width - 1,
    Math.floor(((point.x + 0.5) / GRID_SIZE) * pixels.width),
  )
  const y = Math.min(
    pixels.height - 1,
    Math.floor(((point.y + 0.5) / GRID_SIZE) * pixels.height),
  )
  const offset = (y * pixels.width + x) * 4
  const alpha = pixels.data[offset + 3] / 255
  const bg = background ? normalizeHex(background) : null
  if (!alpha && !bg) return null
  return `#${[0, 1, 2]
    .map(channel => {
      const value = pixels.data[offset + channel]
      const composed = bg
        ? Math.round(
            value * alpha +
              parseInt(bg.slice(1 + channel * 2, 3 + channel * 2), 16) *
                (1 - alpha),
          )
        : value
      return composed.toString(16).padStart(2, '0')
    })
    .join('')
    .toUpperCase()}`
}

/** Tag bytes with their URL so an account/photo change cannot sample stale data. */
export function usePhotoSampler(uri: string | undefined, background?: string) {
  const [loaded, setLoaded] = useState<{
    uri: string
    pixels: PhotoPixels
  } | null>(null)
  useEffect(() => {
    if (!uri) return
    let canceled = false
    void loadPhotoPixels(uri).then(
      pixels => {
        if (!canceled) setLoaded({uri, pixels})
      },
      () => {},
    )
    return () => {
      canceled = true
    }
  }, [uri])
  return (point: Point) =>
    samplePhoto(
      loaded && loaded.uri === uri ? loaded.pixels : null,
      point,
      background,
    )
}
