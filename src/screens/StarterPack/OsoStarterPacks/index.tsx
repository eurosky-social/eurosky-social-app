import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {ListFooter} from '#/components/Lists'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {StarterPackCard} from './components/StarterPackCard'
import {OSO_STARTER_PACKS_ACTOR} from './config'
import {useOsoStarterPacks} from './useOsoStarterPacks'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'OsoStarterPacks'>

export function OsoStarterPacksScreen(_props: Props) {
  const t = useTheme()
  const {
    starterPacks,
    isLoading,
    isRefetching,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useOsoStarterPacks()

  const onEndReached = () => {
    if (hasNextPage && !isLoading && !isFetchingNextPage && !error) {
      fetchNextPage()
    }
  }

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
        data={starterPacks}
        keyExtractor={(item: app.bsky.graph.defs.StarterPackView) => item.uri}
        renderItem={({item}: {item: app.bsky.graph.defs.StarterPackView}) => (
          <View style={[a.px_lg, a.pb_lg]}>
            <StarterPackCard view={item} />
          </View>
        )}
        // The fallback list is fixed, so there is nothing to refresh.
        refreshing={isRefetching}
        onRefresh={OSO_STARTER_PACKS_ACTOR ? () => void refetch() : undefined}
        onEndReached={onEndReached}
        onEndReachedThreshold={2}
        ListHeaderComponent={<View style={[a.pt_lg]} />}
        ListEmptyComponent={
          isLoading || error ? undefined : (
            <View style={[a.p_xl]}>
              <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
                <Trans>No starter packs yet.</Trans>
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          <ListFooter
            isFetchingNextPage={isLoading || isFetchingNextPage}
            error={cleanError(error)}
            onRetry={refetch}
          />
        }
        sideBorders={false}
      />
    </Layout.Screen>
  )
}
