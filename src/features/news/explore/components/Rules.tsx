import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/**
 * The spread's structure is drawn with rules rather than boxes: bands are
 * separated across the full width, columns within a band vertically. Keeping
 * them here means one weight and one colour everywhere on the page.
 */
export function BandRule() {
  const t = useTheme()
  return <View style={[a.border_b, t.atoms.border_contrast_low]} />
}

/** The hairline between two columns of a band. */
export function ColumnRule() {
  const t = useTheme()
  return (
    <View style={[a.self_stretch, a.border_l, t.atoms.border_contrast_low]} />
  )
}

/** A band or column label: small and quiet, never competing with a headline. */
export function KickerText({children}: {children: React.ReactNode}) {
  const t = useTheme()

  return (
    <Text
      accessibilityRole="header"
      style={[
        a.text_sm,
        a.font_bold,
        a.text_left,
        t.atoms.text_contrast_medium,
      ]}>
      {children}
    </Text>
  )
}
