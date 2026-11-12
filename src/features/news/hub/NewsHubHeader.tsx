import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useGutters, useTheme} from '#/alf'
import {BrandLogo} from '#/components/icons/BrandLogo'
import {BRAND} from '#/config/brand'
import {ExploreColumn} from '../explore/components/ExploreColumn'
import {type NewsHubTab, NewsHubTabs} from './NewsHubTabs'

/**
 * The header of the hub's tabbed pages: the brand's logo followed by the tabs,
 * with the page's own control (`children`) at the far end. These pages are where
 * the news starts rather than a step into it, so there is no back button.
 *
 * Laid out across the spread like `ExploreHeaderOuter`, but without its vertical
 * padding, so the current tab's underline sits on the header's bottom border.
 */
export function NewsHubHeader({
  active,
  children,
}: {
  active: NewsHubTab
  children?: React.ReactNode
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const gutters = useGutters([0, 'base'])

  return (
    <ExploreColumn
      style={[
        a.flex_row,
        a.gap_lg,
        a.border_b,
        gutters,
        {minHeight: 52},
        t.atoms.bg,
        t.atoms.border_contrast_low,
      ]}>
      <View
        accessible
        accessibilityLabel={l`${BRAND.name} News`}
        accessibilityHint=""
        style={[a.justify_center]}>
        <BrandLogo size={36} fill={t.atoms.text.color} />
      </View>
      <NewsHubTabs active={active} />
      {children && <View style={[a.justify_center]}>{children}</View>}
    </ExploreColumn>
  )
}
