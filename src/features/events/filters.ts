import {type EventListParams} from './types'

/**
 * The user's filters on the event feeds. Every feed receives them; a feed whose
 * endpoint can't apply one ignores it.
 */
export type EventFilters = {
  /** Free-text place, matched against the events' location text. */
  location?: string
  /** First local day (YYYY-MM-DD) an event may start on. */
  from?: string
  /** Last local day (YYYY-MM-DD) an event may start on. */
  to?: string
}

type EventFilterParams = {location?: string; from?: string; to?: string}

const SIMPLE_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Reads the filters from the `Events` route params, dropping invalid ones. */
export function readEventFilters(params?: EventFilterParams): EventFilters {
  const filters: EventFilters = {}
  const location = params?.location?.trim()
  if (location) filters.location = location
  if (params?.from && SIMPLE_DATE.test(params.from)) filters.from = params.from
  if (params?.to && SIMPLE_DATE.test(params.to)) filters.to = params.to
  return filters
}

const FILTER_PARAM_KEYS = ['location', 'from', 'to'] as const

/**
 * The `Events` route params with `filters` swapped in, for `replaceParams`.
 * Inactive filters are left out entirely: `setParams` would merge them as
 * `undefined`, which the web URL spells out as "undefined".
 */
export function withEventFilterParams<P extends object>(
  params: P | undefined,
  filters: EventFilters,
): P & EventFilterParams {
  const next: Record<string, unknown> = {...params}
  for (const key of FILTER_PARAM_KEYS) {
    const value = filters[key]?.trim()
    if (value) {
      next[key] = value
    } else {
      delete next[key]
    }
  }
  return next as P & EventFilterParams
}

export function hasActiveFilters(filters: EventFilters) {
  return Object.values(filters).some(Boolean)
}

/**
 * The AppView params for the given filters, holding only the active ones so
 * that spreading them over a feed's params never clears its defaults.
 *
 * Dates filter on the event's start, from the start of `from` to the end of
 * `to` in the user's timezone. Events without an end time can't be matched on
 * overlap, so events already underway on `from` are left out.
 */
export function toEventListParams(
  filters: EventFilters,
): Pick<EventListParams, 'startsAtMin' | 'startsAtMax'> & {location?: string} {
  const params: ReturnType<typeof toEventListParams> = {}
  if (filters.location) params.location = filters.location
  // A date-time without an offset parses as local time.
  if (filters.from) {
    params.startsAtMin = new Date(`${filters.from}T00:00:00`).toISOString()
  }
  if (filters.to) {
    params.startsAtMax = new Date(`${filters.to}T23:59:59.999`).toISOString()
  }
  return params
}
