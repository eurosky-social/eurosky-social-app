/*
 * Keep this file separate from the component so the flag and date can be read
 * without pulling React into the importer.
 */

/**
 * Toggle to enable or disable the policy update banner. Flip this to false in a
 * follow-up release once the announcement has run its course - the banner has
 * no automatic expiry.
 */
export const POLICY_UPDATE_BANNER_IS_ENABLED = true

/**
 * The date the updated policies take effect, rendered through `i18n.date` so
 * the banner reads naturally in every locale.
 *
 * Constructed from local date parts rather than an ISO string on purpose: an
 * ISO string is parsed as UTC, so `i18n.date` would render it as the 18th for
 * anyone west of UTC. Month is zero-indexed, so 8 is September.
 */
export const POLICY_UPDATE_EFFECTIVE_DATE = new Date(2026, 8, 19)
