import {type StyleProp, View, type ViewStyle} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

/**
 * The LIVE badge over the player and on cards. Same red as the avatar live
 * indicator, with the pulse dot the mockups carry.
 */
export function LivePill({
  size = 'small',
  style,
}: {
  size?: 'small' | 'large'
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_xs,
        a.rounded_xs,
        size === 'large'
          ? [a.px_sm, a.py_2xs]
          : [a.px_xs, {paddingVertical: 2}],
        {backgroundColor: t.palette.negative_500},
        style,
      ]}>
      <View
        style={[
          a.rounded_full,
          {width: 6, height: 6, backgroundColor: t.palette.white},
        ]}
      />
      <Text
        style={[
          a.font_semi_bold,
          size === 'large' ? a.text_xs : a.text_2xs,
          {color: t.palette.white, letterSpacing: 0.5},
        ]}>
        <Trans comment="Badge on a live broadcast. Keep very short.">
          LIVE
        </Trans>
      </Text>
    </View>
  )
}
