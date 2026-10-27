import {buildThemes} from '#/alf/themes'
import {type AccentKey, ACCENTS, DEFAULT_ACCENT} from '#/config/brand-theme'

/**
 * The accent Halloween switches to. Brands without an orange family (Oso
 * ships purple only) keep their own accent.
 */
export const HALLOWEEN_ACCENT = (
  'orange' in ACCENTS ? 'orange' : DEFAULT_ACCENT
) as AccentKey

/** Reuse the normal brand palettes; Halloween only changes mode and accent. */
export const halloweenThemes = buildThemes(HALLOWEEN_ACCENT)
