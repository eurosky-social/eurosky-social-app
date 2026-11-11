import {View} from 'react-native'

import {atoms as a} from '#/alf'
import {Link, type LinkProps} from '#/components/Link'
import {Text} from '#/components/Typography'
import {CELL_PADDING} from './BoxGrid'

/** The section title above its boxed grid, and "See all" when a destination exists. */
export function SectionHeading({
  id,
  title,
  seeAll,
}: {
  id: string
  title: string
  seeAll?: {to: LinkProps['to']; label: string; text: string}
}) {
  return (
    <View
      testID={`sectionHeading-${id}`}
      style={[
        a.flex_row,
        a.align_end,
        a.justify_between,
        a.gap_md,
        a.pt_2xl,
        a.pb_md,
        /* Grids run edge to edge, so headings line up with the card text. */
        {paddingHorizontal: CELL_PADDING},
      ]}>
      <Text
        emoji
        accessibilityRole="header"
        style={[a.font_semi_bold, {fontSize: 22, lineHeight: 26}]}>
        {title}
      </Text>
      {seeAll && (
        <Link
          testID={`sectionSeeAll-${id}`}
          to={seeAll.to}
          label={seeAll.label}
          hitSlop={{top: 10, bottom: 10, left: 8, right: 8}}
          style={[{minHeight: 24}]}>
          <Text style={[a.text_sm, a.font_medium]}>{seeAll.text}</Text>
        </Link>
      )}
    </View>
  )
}
