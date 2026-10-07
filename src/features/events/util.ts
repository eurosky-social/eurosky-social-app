import {CDN_SERVICE} from '#/lib/constants'
import {type EventMedia, type EventRecord} from './types'

/**
 * Picks the event's thumbnail, falling back to its banner or first image.
 * Returns undefined when the event has no image.
 */
export function getEventImage(event: EventRecord):
  | {
      url: string
      alt?: string
    }
  | undefined {
  const images = (event.value.media ?? []).filter(isImage)
  const media =
    images.find(m => m.role === 'thumbnail') ??
    images.find(m => m.role === 'banner') ??
    images[0]
  const cid = media?.content?.ref?.$link
  if (!cid) return undefined

  /*
   * Blobs live on the organiser's PDS. The Bluesky image CDN fetches them from
   * there and serves resized JPEGs, so we don't need to resolve the PDS.
   */
  return {
    url: `${CDN_SERVICE}/img/feed_thumbnail/plain/${event.did}/${cid}@jpeg`,
    alt: media.alt,
  }
}

function isImage(media: EventMedia) {
  return media.content?.mimeType?.startsWith('image/') ?? false
}
