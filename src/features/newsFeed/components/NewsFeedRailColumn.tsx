import {ScrollView, View} from 'react-native'

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
export function NewsFeedRailColumn({top}: {top: number}) {
  const gutters = useGutters(['base', 0, 'base', 'wide'])
  const {centerColumnOffset} = useLayoutBreakpoints()
  const width = centerColumnOffset ? 250 : 300

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
      <View
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
          web({
            position: 'sticky',
            top,
            maxHeight: `calc(100vh - ${top}px)`,
          }),
        ]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <NewsFeedRightRail />
        </ScrollView>
      </View>
    </View>
  )
}
