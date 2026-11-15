/**
 * mu fork: which case of the age gate (NoAccessScreen) applies. Only
 * meaningful while the shell shows the gate (access === None).
 *
 *  - `undeclared`: no declared age yet, so the one-time birthdate prompt
 *  - `under-app-min`: declared under 13, blocked everywhere
 *  - `under-region-min`: declared below the region's minimum age
 *  - `needs-verification`: declared over the minimum, but the region only
 *    grants access on a verified age (US-MS; US-TX on native)
 */
export type NoAccessReason =
  'undeclared' | 'under-app-min' | 'under-region-min' | 'needs-verification'

export function getNoAccessReason({
  hasDeclaredAge,
  isOverAppMinAccessAge,
  isAARegion,
  isOverRegionMinAccessAge,
}: {
  hasDeclaredAge: boolean
  isOverAppMinAccessAge: boolean
  isAARegion: boolean
  isOverRegionMinAccessAge: boolean
}): NoAccessReason {
  if (!hasDeclaredAge) return 'undeclared'
  if (!isOverAppMinAccessAge) return 'under-app-min'
  if (isAARegion && !isOverRegionMinAccessAge) return 'under-region-min'
  return 'needs-verification'
}
