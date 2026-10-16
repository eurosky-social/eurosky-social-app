/**
 * Colours from the Oso design references (landing page and sidebar buttons).
 */
export const OSO_COLORS = {
  black: '#000000',
  yellow: '#F8FD79',
  blue: '#5167FF',
  green: '#00E068',
  violet: '#5644FA',
  lemon: '#F3FF51',
  grey: '#958A95',
  coral: '#FA614C',
  mint: '#AAEDE6',
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
