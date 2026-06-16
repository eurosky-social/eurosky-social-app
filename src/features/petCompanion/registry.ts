// Registry of companion species. Adding a pet is: drop a `species/<name>/`
// module (catalog + art), import it here, and add it to PETS. Nothing else in
// the feature references a concrete species.

import {cat} from './species/cat/catalog'
import {fox} from './species/fox/catalog'
import {type Species} from './types'

export const DEFAULT_SPECIES_ID = 'cat'

// Order here is the order shown in the settings picker.
export const PET_LIST: readonly Species[] = [cat, fox]

export const PETS: Record<string, Species> = Object.fromEntries(
  PET_LIST.map(s => [s.id, s]),
)

// Resolve a (possibly stale/persisted) species id to a Species, falling back to
// the default so a removed or unknown id never crashes the companion.
export function getSpecies(id: string | undefined): Species {
  return (id && PETS[id]) || PETS[DEFAULT_SPECIES_ID]
}

// Clamp a variant to one this species actually has, else its default. Used when
// switching species, since a coat valid for one pet may not exist for another.
export function resolveVariant(
  species: Species,
  variant: string | undefined,
): string {
  return variant && species.variants.includes(variant)
    ? variant
    : species.defaultVariant
}
