import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {useStarterPackQuery} from '#/state/queries/starter-packs'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {
  StarterPackCard,
  StarterPackCardSkeleton,
} from './components/StarterPackCard'
import {OSO_CURATED_PACKS} from './osoCuratedPacks'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'OsoStarterPacks'>

export function OsoStarterPacksScreen(_props: Props) {
  const t = useTheme()

  return (
    <Layout.Screen testID="osoStarterPacksScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Starter Packs</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <List
        data={OSO_CURATED_PACKS}
        keyExtractor={(uri: string) => uri}
        renderItem={({item}: {item: string}) => <StarterPackRow uri={item} />}
        ListHeaderComponent={<View style={[a.pt_lg]} />}
        ListEmptyComponent={
          <View style={[a.p_xl]}>
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              <Trans>No starter packs yet.</Trans>
            </Text>
          </View>
        }
        sideBorders={false}
      />
    </Layout.Screen>
  )
}

/**
 * Loads one pack by URI. A pack that fails to load (deleted, taken down) is
 * left out rather than failing the whole list.
 */
function StarterPackRow({uri}: {uri: string}) {
  const {data, isLoading} = useStarterPackQuery({uri})

  if (isLoading) {
    return (
      <View style={[a.px_lg, a.pb_lg]}>
        <StarterPackCardSkeleton />
      </View>
    )
  }

  if (!data) return null

  return (
    <View style={[a.px_lg, a.pb_lg]}>
      <StarterPackCard view={data} />
    </View>
  )
}
