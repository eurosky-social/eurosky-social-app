import {View} from 'react-native'

import {
  atoms as a,
  useBreakpoints,
  useGutters,
  useLayoutBreakpoints,
  useTheme,
  web,
} from '#/alf'
import {CENTER_COLUMN_OFFSET, SCROLLBAR_OFFSET} from '#/components/Layout'
import {usePageGeometry as useExploreSpread} from '#/features/product/layout/usePageGeometry'

export {usePageGeometry as useExploreSpread} from '#/features/product/layout/usePageGeometry'

/**
 * Centers content in the spread. Mirrors `Layout.Center`, at the spread's width
 * rather than the center column's.
 */
export function ExploreColumn({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.ComponentProps<typeof View>['style']
}) {
  const {gtMobile} = useBreakpoints()
  const {centerColumnOffset} = useLayoutBreakpoints()
  const {width, offset} = useExploreSpread()

  return (
    <View
      style={[
        a.w_full,
        a.mx_auto,
        gtMobile && {maxWidth: width},
        {
          transform: [
            {translateX: offset},
            {translateX: centerColumnOffset ? CENTER_COLUMN_OFFSET : 0},
            {translateX: web(SCROLLBAR_OFFSET) ?? 0},
          ],
        },
        style,
      ]}>
      {children}
    </View>
  )
}

/**
 * The screen header, laid out across the spread. Mirrors `Layout.Header.Outer`
 * (which is fixed to the center column's width) so the header's controls sit on
 * the spread's edges rather than partway across it; the slots, back button and
 * title inside it are the shared `Layout.Header` pieces.
 */
export function ExploreHeaderOuter({children}: {children: React.ReactNode}) {
  const t = useTheme()
  const gutters = useGutters([0, 'base'])

  return (
    <ExploreColumn
      style={[
        a.border_b,
        a.flex_row,
        a.align_center,
        a.gap_sm,
        a.py_xs,
        gutters,
        {minHeight: 52},
        /*
         * Painted but not sticky: each hub page pins its header together with
         * its filter bar, and slides the header away on scroll, which a sticky
         * header of its own would hold in place.
         */
        t.atoms.bg,
        t.atoms.border_contrast_low,
      ]}>
      {children}
    </ExploreColumn>
  )
}

/**
 * The spread's left seam with the shell, in place of the center column's edges
 * (`Layout.Screen` draws those, and the screen opts out of them). Only the left
 * edge is drawn: the spread's right edge is the window's, and a rule there
 * would read as a column boundary rather than the page ending.
 */
export function ExploreSpreadBorders() {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const {centerColumnOffset} = useLayoutBreakpoints()
  const {width, offset} = useExploreSpread()

  if (!gtMobile) return null

  return (
    <View
      style={[
        a.fixed,
        a.inset_0,
        a.border_l,
        t.atoms.border_contrast_low,
        web({
          width: width + 1,
          left: '50%',
          transform: [
            {translateX: '-50%'},
            {translateX: offset},
            {translateX: centerColumnOffset ? CENTER_COLUMN_OFFSET : 0},
            ...a.scrollbar_offset.transform,
          ],
        }),
      ]}
    />
  )
}
