/**
 * Colours from the Oso design references. The named swatches come from
 * __design_references__/colors/ (blue is the "light_blue" swatch).
 */
export const OSO_COLORS = {
  yellow: '#F9FD8C',
  blue: '#5566F6',
  green: '#66DD76',
  skyBlue: '#B8EBE6',
  darkBlue: '#204495',
  grayBrown: '#938A94',
  red: '#EE835B',
  creme: '#FCEDC6',
  white: '#FFFFFF',
  /** Oso's main accent ("hoofdkleur") and dark background. */
  navy: '#161924',
  /** Oso's supporting accent ("steunkleur"), used for highlights. */
  highlight: '#79FD9A',
}

/**
 * ABC Solar Display, bundled by scripts/prepare-oso-preview.mjs (Medium as
 * 500, Bold as 700). ss05 is the stylistic set with the angled "t" used in the
 * designs. Use it with the plain react-native Text, because Typography's Text
 * swaps in the theme font.
 */
export const OSO_DISPLAY_FONT =
  'ABCSolarDisplay, LeagueSpartan, system-ui, sans-serif'
export const OSO_DISPLAY_FEATURES = '"ss05"'
