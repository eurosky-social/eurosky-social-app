import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useEnableMinimalShellMode} from '#/state/shell/minimal-mode'
import {atoms as a} from '#/alf'
import {BrandLogo} from '#/components/icons/BrandLogo'
import {OSO_COLORS} from './theme'
import {OsoTileGrid} from './TileGrid'

export type OsoLandingDestination = 'news' | 'events' | 'explore'

/**
 * Full-screen chooser that is Oso's home page. No navigation chrome: the user
 * picks news, events or explore, and the app continues from there as usual.
 */
export function OsoLanding({
  onSelect,
}: {
  onSelect: (destination: OsoLandingDestination) => void
}) {
  const {t: l} = useLingui()
  useEnableMinimalShellMode()

  return (
    <View
      testID="osoLanding"
      style={[
        a.util_screen_outer,
        a.flex_1,
        a.justify_center,
        a.align_center,
        a.px_xl,
        a.gap_4xl,
        {paddingBottom: '10vh', backgroundColor: OSO_COLORS.black},
      ]}>
      <BrandLogo variant="mark" size={161} fill="#FFFFFF" />
      <OsoTileGrid
        holeColor={OSO_COLORS.black}
        tiles={[
          {
            testID: 'osoLandingNews',
            label: l({
              message: 'news',
              comment:
                'Oso landing page tile linking to the news hub. Lowercase on purpose.',
            }),
            hint: l`Opens the news page`,
            onPress: () => onSelect('news'),
          },
          {
            testID: 'osoLandingEvents',
            label: l({
              message: 'events',
              comment:
                'Oso landing page tile linking to the events page. Lowercase on purpose.',
            }),
            hint: l`Opens the events page`,
            onPress: () => onSelect('events'),
          },
          {
            testID: 'osoLandingExplore',
            label: l({
              message: 'explore',
              comment:
                'Oso landing page tile linking to the explore page. Lowercase on purpose.',
            }),
            hint: l`Opens the explore page`,
            onPress: () => onSelect('explore'),
          },
        ]}
      />
    </View>
  )
}
