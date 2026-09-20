import {useWindowDimensions, View} from 'react-native'

import {
  atoms as a,
  useBreakpoints,
  useGutters,
  useLayoutBreakpoints,
  useTheme,
  web,
} from '#/alf'
import {
  CENTER_COLUMN_OFFSET,
  CENTER_COLUMN_WIDTH,
  SCROLLBAR_OFFSET,
} from '#/components/Layout'
import {IS_WEB} from '#/env'

/** Breathing room between the spread and the window's right edge. */
const EDGE_GUTTER = 40

/** Past this, more width only stretches headlines; the spread stops growing. */
const MAX_SPREAD_WIDTH = 1500

/**
 * The explore page's geometry. It is the one newsroom surface that is not a
 * branded org space, so instead of `Layout.Center`'s fixed 600px column it runs
 * from the center column's left edge to the window's right edge - the shell
 * hides the right rail on this route (see `DesktopRightNav`) and the spread
 * takes everything it leaves.
 *
 * Below the right-nav breakpoint, and on native, the spread is just the center
 * column and its bands stack.
 */
export function useExploreSpread() {
  const {rightNavVisible, centerColumnOffset} = useLayoutBreakpoints()
  const {width: windowWidth} = useWindowDimensions()
  const wide = IS_WEB && rightNavVisible

  /*
   * The center column sits at `windowWidth / 2 - 300` (shifted left on the
   * tablet breakpoint), so everything from there to the right edge is the
   * spread's to use.
   */
  const available =
    windowWidth / 2 +
    CENTER_COLUMN_WIDTH / 2 -
    EDGE_GUTTER -
    (centerColumnOffset ? CENTER_COLUMN_OFFSET : 0)
  const width = wide
    ? Math.min(Math.max(available, CENTER_COLUMN_WIDTH), MAX_SPREAD_WIDTH)
    : CENTER_COLUMN_WIDTH

  return {
    /** Whether the spread currently reaches into the right column. */
    wide,
    width,
    /**
     * Keeps the wider column's left edge on the center column's: the column is
     * centered in the window, so it shifts right by half the added width.
     */
    offset: (width - CENTER_COLUMN_WIDTH) / 2,
  }
}

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
  const {gtMobile} = useBreakpoints()

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
        gtMobile && web([a.sticky, {top: 0}, a.z_10, t.atoms.bg]),
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
