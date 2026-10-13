import {isOverMaxGraphemeCount} from '#/lib/strings/helpers'
import {type ImageMeta} from '#/state/gallery'
import {EVENT_NSID} from '../../config'
import {
  type Blob,
  type EventLocation,
  type EventMedia,
  type EventMode,
  type EventRecord,
  type EventRecordValue,
  type EventStatus,
} from '../../types'
import {getEventImage, getEventImageIndex} from '../../util'

export const NAME_MAX_GRAPHEMES = 100
export const DESCRIPTION_MAX_GRAPHEMES = 3000
export const IMAGE_ALT_MAX_GRAPHEMES = 2000

const ADDRESS_TYPE = 'community.lexicon.location.address'

export type EventFormValues = {
  name: string
  description: string
  startsAt?: Date
  endsAt?: Date
  mode: EventMode
  status: EventStatus
  /** Venue name, e.g. "Paradiso". */
  venue: string
  street: string
  locality: string
  /** ISO 3166-1 alpha-2 code, e.g. "NL". */
  country: string
  linkUri: string
  linkName: string
  /** The event's cover image, if it has one. */
  image?: EventFormImage
  imageAlt: string
}

export type EventFormImage = {
  /** Preview URI: the CDN URL of the saved image, or the picked file. */
  uri: string
  /** A newly picked image, uploaded on save. */
  upload?: ImageMeta
}

export type EventFormField = keyof EventFormValues

export type EventFormError =
  'required' | 'tooLong' | 'endBeforeStart' | 'invalidCountry' | 'invalidUrl'

export type EventFormErrors = Partial<Record<EventFormField, EventFormError>>

/**
 * The form's starting values: the event's when editing, defaults otherwise.
 * The form edits the first address location and the first link; any others
 * are kept as they are by `toRecord`.
 */
export function fromRecord(event?: EventRecord): EventFormValues {
  const value = event?.value
  const address = value?.locations?.find(isAddress)
  const link = value?.uris?.[0]
  const image = event && getEventImage(event)

  return {
    name: value?.name ?? '',
    description: value?.description ?? '',
    startsAt: parseDate(value?.startsAt),
    endsAt: parseDate(value?.endsAt),
    mode: value?.mode ?? 'community.lexicon.calendar.event#inperson',
    status: value?.status ?? 'community.lexicon.calendar.event#scheduled',
    venue: address?.name ?? '',
    street: address?.street ?? '',
    locality: address?.locality ?? '',
    country: address?.country ?? '',
    linkUri: link?.uri ?? '',
    linkName: link?.name ?? '',
    image: image && {uri: image.url},
    imageAlt: image?.alt ?? '',
  }
}

export function validate(values: EventFormValues): EventFormErrors {
  const errors: EventFormErrors = {}

  if (!values.name.trim()) {
    errors.name = 'required'
  } else if (
    isOverMaxGraphemeCount({text: values.name, maxCount: NAME_MAX_GRAPHEMES})
  ) {
    errors.name = 'tooLong'
  }

  if (
    isOverMaxGraphemeCount({
      text: values.description,
      maxCount: DESCRIPTION_MAX_GRAPHEMES,
    })
  ) {
    errors.description = 'tooLong'
  }

  if (!values.startsAt) {
    errors.startsAt = 'required'
  } else if (values.endsAt && values.endsAt <= values.startsAt) {
    errors.endsAt = 'endBeforeStart'
  }

  // The address lexicon requires a country, so ask for one with any address.
  if (usesAddress(values)) {
    if (!values.country.trim()) {
      errors.country = 'required'
    } else if (!/^[a-z]{2}$/i.test(values.country.trim())) {
      errors.country = 'invalidCountry'
    }
  }

  if (values.linkUri.trim() && !isHttpUrl(values.linkUri.trim())) {
    errors.linkUri = 'invalidUrl'
  }

  if (
    isOverMaxGraphemeCount({
      text: values.imageAlt,
      maxCount: IMAGE_ALT_MAX_GRAPHEMES,
    })
  ) {
    errors.imageAlt = 'tooLong'
  }

  return errors
}

/**
 * Builds the record to write. When editing, fields the form doesn't cover
 * (other media, locations and links, unknown fields) carry over, because
 * `putRecord` replaces the whole record.
 *
 * @param uploadedImage The blob of `values.image.upload`, once uploaded.
 */
export function toRecord(
  values: EventFormValues,
  existing?: EventRecord,
  uploadedImage?: Blob,
): EventRecordValue {
  const prev = existing?.value

  // The form edits the display image, in place; other media is untouched.
  const prevMedia = prev?.media ?? []
  const imageIndex = getEventImageIndex(prevMedia)
  const alt = values.imageAlt.trim() || undefined
  let image: EventMedia | undefined
  if (values.image?.upload) {
    if (!uploadedImage) throw new Error('Event image was not uploaded')
    const {width, height} = values.image.upload
    image = {
      role: 'banner',
      content: uploadedImage,
      alt,
      aspect_ratio: {width, height},
    }
  } else if (values.image && imageIndex !== -1) {
    image = {...prevMedia[imageIndex], alt}
  }
  const media =
    imageIndex === -1
      ? image
        ? [image, ...prevMedia]
        : prevMedia
      : prevMedia.flatMap((m, i) =>
          i !== imageIndex ? [m] : image ? [image] : [],
        )

  // Swap the first address in place, so the others keep their order.
  const otherLocations = (prev?.locations ?? []).filter(
    (_, i, all) => i !== all.findIndex(isAddress),
  )
  const address: EventLocation | undefined = usesAddress(values)
    ? {
        $type: ADDRESS_TYPE,
        name: values.venue.trim() || undefined,
        street: values.street.trim() || undefined,
        locality: values.locality.trim() || undefined,
        country: values.country.trim().toUpperCase(),
      }
    : undefined
  const locations = address ? [address, ...otherLocations] : otherLocations

  const otherLinks = (prev?.uris ?? []).slice(1)
  const linkUri = values.linkUri.trim()
  const uris = linkUri
    ? [{uri: linkUri, name: values.linkName.trim() || undefined}, ...otherLinks]
    : otherLinks

  return {
    ...prev,
    $type: EVENT_NSID,
    name: values.name.trim(),
    description: values.description.trim() || undefined,
    startsAt: values.startsAt?.toISOString(),
    endsAt: values.endsAt?.toISOString(),
    mode: values.mode,
    status: values.status,
    locations: locations.length ? locations : undefined,
    uris: uris.length ? uris : undefined,
    media: media.length ? media : undefined,
    createdAt:
      typeof prev?.createdAt === 'string'
        ? prev.createdAt
        : new Date().toISOString(),
  }
}

/** Whether two sets of values differ, for the unsaved-changes guard. */
export function isDirty(a: EventFormValues, b: EventFormValues) {
  return (Object.keys(a) as EventFormField[]).some(key => {
    const x = a[key]
    const y = b[key]
    if (x instanceof Date || y instanceof Date) {
      return (
        (x as Date | undefined)?.getTime() !==
        (y as Date | undefined)?.getTime()
      )
    }
    return x !== y
  })
}

/** Virtual events hide the address fields, so they write no address. */
export function usesAddress(values: EventFormValues) {
  return (
    values.mode !== 'community.lexicon.calendar.event#virtual' &&
    [values.venue, values.street, values.locality, values.country].some(part =>
      part.trim(),
    )
  )
}

function isAddress(location: EventLocation) {
  return location.$type === ADDRESS_TYPE
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** Record timestamps can be malformed (`{}`), so parse defensively. */
function parseDate(value: string | {} | undefined): Date | undefined {
  if (typeof value !== 'string') return undefined
  const date = new Date(value)
  return isNaN(date.getTime()) ? undefined : date
}
