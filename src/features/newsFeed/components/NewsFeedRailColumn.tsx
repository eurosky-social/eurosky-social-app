import {ScrollView, View} from 'react-native'
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated'

import {atoms as a, tokens, useGutters, useLayoutBreakpoints, web} from '#/alf'
import {CENTER_COLUMN_OFFSET} from '#/components/Layout'
import {NewsFeedRightRail} from './NewsFeedRightRail'

/**
 * The news feed's right column, drawn by the page rather than the shell.
 *
 * The shell fixes its right column to the window, which is fine under a
 * header that scrolls away, but the feed pins a full-width header and tab row
 * above the column. A fixed column would need starting below that row, and
 * would stay put while the rest of the page rubber-bands at the top. Laid out
 * in the page and sticky instead, it scrolls, pins and bounces with
 * everything else.
 *
 * It sits exactly where the shell would have put it: absolutely positioned
 * over the feed, beside the center column, with the same width and gutters.
 */
export function NewsFeedRailColumn({
  top,
  offset,
}: {
  /** Height of the pinned header and tabs the column sits under. */
  top: number
  /** How far that pinned block has slid up as its title collapses. */
  offset: SharedValue<number>
}) {
  const gutters = useGutters(['base', 0, 'base', 'wide'])
  const {centerColumnOffset} = useLayoutBreakpoints()
  const width = centerColumnOffset ? 250 : 300
  /* Follows the pinned block up, so no gap opens above the column. */
  const pinStyle = useAnimatedStyle(() => {
    const pinnedAt = top + offset.get()
    return {top: pinnedAt, maxHeight: `calc(100vh - ${pinnedAt}px)`}
  })

  return (
    <View
      pointerEvents="box-none"
      style={[
        a.absolute,
        {
          top: 0,
          bottom: 0,
          left: '50%',
          width: width + gutters.paddingLeft + 2,
          transform: [
            {translateX: 300 + (centerColumnOffset ? CENTER_COLUMN_OFFSET : 0)},
            ...a.scrollbar_offset.transform,
          ],
        },
      ]}>
      <Animated.View
        style={[
          a.pr_2xs,
          {
            /*
             * The rail's modules carry their own px_lg edge padding and 2xl
             * top padding, so back those out of the gutters, as the shell does.
             */
            paddingBottom: gutters.paddingBottom,
            paddingLeft: gutters.paddingLeft - tokens.space.lg,
          },
          web({position: 'sticky'}),
          pinStyle,
        ]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <NewsFeedRightRail />
        </ScrollView>
      </Animated.View>
    </View>
  )
}
