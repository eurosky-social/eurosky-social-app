import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {OsoTileGrid} from '#/features/osoLanding/TileGrid'

/**
 * Oso's explore page: landing-style tiles for starter packs, the full explore
 * page and feeds. Shown on /search when there is no query.
 */
export function OsoExploreHub() {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()

  return (
    <Layout.Screen testID="osoExploreHub">
      <Layout.Header.Outer>
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Explore</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
      </Layout.Header.Outer>
      <Layout.Center>
        <View style={[a.align_center, a.px_xl, a.pt_4xl]}>
          <OsoTileGrid
            holeColor={t.atoms.bg.backgroundColor}
            tiles={[
              {
                testID: 'osoExploreStarterPacks',
                label: l({
                  message: 'starter packs',
                  comment:
                    'Oso explore page tile linking to starter packs. Lowercase on purpose.',
                }),
                hint: l`Opens the starter packs page`,
                onPress: () => navigation.navigate('OsoStarterPacks'),
              },
              {
                testID: 'osoExploreExplore',
                label: l({
                  message: 'explore',
                  comment:
                    'Oso explore page tile linking to the full explore page. Lowercase on purpose.',
                }),
                hint: l`Opens trending topics, suggested people and more`,
                onPress: () => navigation.push('Search', {view: 'explore'}),
              },
              {
                testID: 'osoExploreFeeds',
                label: l({
                  message: 'feeds',
                  comment:
                    'Oso explore page tile linking to feeds. Lowercase on purpose.',
                }),
                hint: l`Opens the feeds page`,
                onPress: () => navigation.navigate('Feeds'),
              },
            ]}
          />
        </View>
      </Layout.Center>
    </Layout.Screen>
  )
}
