import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {type NavigationGroup} from '#/config/navigation'

/**
 * A small uppercase label above each navigation group, with a modest rule
 * before every group but the first. The icon rail keeps only the rule.
 */
export function NavGroupHeading({
  group,
  first,
  minimal = false,
}: {
  group: NavigationGroup
  first: boolean
  minimal?: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const label = group === 'forYou' ? l`For you` : l`Explore`
  return (
    <>
      {!first && (
        <View
          testID={`navGroupDivider-${group}`}
          style={[
            a.my_md,
            minimal ? {width: 32} : a.mx_md,
            {height: 1},
            t.atoms.bg_contrast_100,
          ]}
        />
      )}
      {!minimal && (
        <Text
          testID={`navGroupHeading-${group}`}
          accessibilityRole="header"
          style={[
            a.px_md,
            a.py_xs,
            a.font_semi_bold,
            t.atoms.text_contrast_medium,
            {fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase'},
          ]}>
          {label}
        </Text>
      )}
    </>
  )
}
