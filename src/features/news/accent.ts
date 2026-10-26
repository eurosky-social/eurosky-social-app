import {type Theme, utils} from '#/alf'

/** WCAG AA for normal-size text. */
const MIN_CONTRAST = 4.5

/** Points of HSL lightness the accent may shift before it stops reading as the brand. */
const MAX_SHIFT = 45
const SHIFT_STEP = 5

/**
 * A publisher's brand color, shifted in lightness until it is legible against
 * the current background. Falls back to the theme accent when no shift within
 * `MAX_SHIFT` clears `MIN_CONTRAST`.
 */
export function readableAccent(accent: string | undefined, t: Theme): string {
  if (!accent) return t.palette.primary_500

  const background = t.atoms.bg.backgroundColor
  if (utils.contrastRatio(accent, background) === null) {
    return t.palette.primary_500
  }

  // Shift away from the background: lighter on dark themes, darker on light.
  const towardLight = isDarkBackground(background)
  for (let shift = 0; shift <= MAX_SHIFT; shift += SHIFT_STEP) {
    const candidate =
      shift === 0
        ? accent
        : towardLight
          ? utils.lighten(accent, shift)
          : utils.darken(accent, shift)
    const ratio = utils.contrastRatio(candidate, background)
    if (ratio !== null && ratio >= MIN_CONTRAST) return candidate
  }

  return t.palette.primary_500
}

function isDarkBackground(background: string): boolean {
  const vsWhite = utils.contrastRatio(background, '#FFFFFF')
  const vsBlack = utils.contrastRatio(background, '#000000')
  if (vsWhite === null || vsBlack === null) return false
  return vsWhite > vsBlack
}
