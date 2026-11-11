import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {Link, type LinkProps} from '#/components/Link'
import {Text} from '#/components/Typography'

/** A 2px rule, the section title, and "See all" when a destination exists. */
export function SectionHeading({
  id,
  title,
  seeAll,
}: {
  id: string
  title: string
  seeAll?: {to: LinkProps['to']; label: string; text: string}
}) {
  const t = useTheme()
  return (
    <View
      testID={`sectionHeading-${id}`}
      style={[
        a.flex_row,
        a.align_center,
        a.justify_between,
        a.gap_md,
        a.pt_md,
        a.mt_lg,
        {borderTopWidth: 2},
        t.atoms.border_contrast_high,
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
          style={[{minHeight: 24}]}>
          <Text style={[a.text_sm, a.font_medium]}>{seeAll.text}</Text>
        </Link>
      )}
    </View>
  )
}
