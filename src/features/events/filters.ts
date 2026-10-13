/**
 * The user's filters on the event feeds. Every feed receives them; a feed whose
 * endpoint can't apply one ignores it.
 */
export type EventFilters = {
  /** Free-text place, matched against the events' location text. */
  location?: string
}

/** Reads the filters from the `Events` route params. */
export function readEventFilters(params?: {location?: string}): EventFilters {
  const location = params?.location?.trim()
  return location ? {location} : {}
}

/**
 * Route params for the given filters. Inactive filters map to `undefined`, so
 * `setParams` drops them from the URL.
 */
export function eventFiltersToRouteParams(filters: EventFilters) {
  return {location: filters.location?.trim() || undefined}
}

export function hasActiveFilters(filters: EventFilters) {
  return Object.values(filters).some(Boolean)
}
