import {useState} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {type NavigationProp} from '#/lib/routes/types'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {SearchInput} from '#/components/forms/SearchInput'
import * as Layout from '#/components/Layout'
import {OSO_COLORS} from '#/features/osoLanding/theme'
import {OsoTileGrid} from '#/features/osoLanding/TileGrid'
import {OsoTitlePill} from '#/features/osoNav/pills'

/** All three explore tiles are black with white text. */
const TILE_COLORS = {background: OSO_COLORS.navy, text: OSO_COLORS.white}

/**
 * Oso's explore page: a search bar above landing-style tiles for starter
 * packs, trending and feeds. Shown on /search when there is no query.
 */
export function OsoExploreHub() {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {gtMobile} = useBreakpoints()
  const [query, setQuery] = useState('')

  return (
    <Layout.Screen testID="osoExploreHub">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          {/* Titled with the same pill as the explore button in the menu. */}
          <OsoTitlePill kind="explore" />
        </Layout.Header.Content>
      </Layout.Header.Outer>
      <Layout.Center>
        <View style={[a.align_center, a.px_xl, a.pt_4xl, a.gap_xl]}>
          {/* As wide as the tiles below it. */}
          <View
            style={[a.w_full, {maxWidth: gtMobile ? 520 : 320}]}
            testID="osoExploreSearch">
            <SearchInput
              value={query}
              onChangeText={setQuery}
              onClearText={() => setQuery('')}
              onSubmitEditing={() => {
                const q = query.trim()
                if (q) navigation.push('Search', {q})
              }}
            />
          </View>
          <OsoTileGrid
            holeColor={t.atoms.bg.backgroundColor}
            tiles={[
              {
                testID: 'osoExploreStarterPacks',
                label: l({
                  message: 'starter\npacks',
                  comment:
                    'Oso explore page tile linking to starter packs. Lowercase on purpose; the line break splits the label over two lines.',
                }),
                hint: l`Opens the starter packs page`,
                fontScale: 0.66,
                // Same colours as the starter packs page title.
                colors: TILE_COLORS,
                onPress: () => navigation.navigate('OsoStarterPacks'),
              },
              {
                testID: 'osoExploreTrending',
                colors: TILE_COLORS,
                label: l({
                  message: 'trending',
                  comment:
                    'Oso explore page tile linking to the trending page. Lowercase on purpose.',
                }),
                hint: l`Opens the five top trending topics`,
                // Smaller so the word fits the narrow tile on desktop.
                fontScale: 0.77,
                onPress: () => navigation.navigate('OsoTrending'),
              },
              {
                testID: 'osoExploreFeeds',
                colors: TILE_COLORS,
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
