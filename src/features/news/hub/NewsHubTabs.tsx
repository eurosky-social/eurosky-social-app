import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useGutters, useTheme, web} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'

export type NewsHubTab = 'news' | 'outlets' | 'supplements'

/**
 * The hub's tabs: the news itself, and the outlets behind it. Each is a page
 * of its own, so these are links rather than a pager, and a tab can be shared
 * or opened in a new window like any other page.
 */
export function NewsHubTabs({active}: {active: NewsHubTab}) {
  const {t: l} = useLingui()
  const gutters = useGutters([0, 'base'])

  return (
    <View accessibilityRole="tablist" style={[a.flex_row, a.gap_lg, gutters]}>
      <HubTab
        to="/news/explore"
        label={l`News`}
        selected={active === 'news'}
        testID="newsHubTab-news"
      />
      <HubTab
        to="/news/outlets"
        label={l({message: 'Outlets', context: 'News outlets tab'})}
        selected={active === 'outlets'}
        testID="newsHubTab-outlets"
      />
      <HubTab
        to="/news/supplements"
        label={l({message: 'Supplements', context: 'News supplements tab'})}
        selected={active === 'supplements'}
        testID="newsHubTab-supplements"
      />
    </View>
  )
}

function HubTab({
  to,
  label,
  selected,
  testID,
}: {
  to: string
  label: string
  selected: boolean
  testID: string
}) {
  const t = useTheme()
  return (
    <Link
      testID={testID}
      to={to}
      label={label}
      /* The current tab stays where it is rather than stacking itself. */
      action={selected ? 'replace' : 'navigate'}
      accessibilityState={{selected}}
      style={[a.rounded_0, a.px_0, web({cursor: 'pointer'})]}>
      {({hovered, pressed}) => (
        <View
          style={[
            a.py_sm,
            a.border_b,
            {
              borderBottomWidth: 2,
              borderBottomColor: selected
                ? t.palette.primary_500
                : 'transparent',
            },
          ]}>
          <Text
            style={[
              a.text_md,
              selected ? a.font_bold : a.font_medium,
              selected || hovered || pressed
                ? t.atoms.text
                : t.atoms.text_contrast_medium,
            ]}>
            {label}
          </Text>
        </View>
      )}
    </Link>
  )
}
