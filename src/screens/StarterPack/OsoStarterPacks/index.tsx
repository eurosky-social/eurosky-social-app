import {View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {useStarterPackQuery} from '#/state/queries/starter-packs'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import {ListFooter} from '#/components/Lists'
import {Text} from '#/components/Typography'
import {OsoTitlePill} from '#/features/osoNav/pills'
import {
  StarterPackCard,
  StarterPackCardSkeleton,
} from './components/StarterPackCard'
import {OSO_STARTER_PACKS_ACTOR} from './config'
import {useOsoStarterPackUris} from './useOsoStarterPackUris'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'OsoStarterPacks'>

export function OsoStarterPacksScreen(_props: Props) {
  const t = useTheme()
  const {
    uris,
    isLoading,
    isRefetching,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useOsoStarterPackUris()

  const onEndReached = () => {
    if (hasNextPage && !isFetchingNextPage && !error) fetchNextPage()
  }

  return (
    <Layout.Screen testID="osoStarterPacksScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <OsoTitlePill kind="starterPacks" />
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <List
        data={uris}
        keyExtractor={(uri: string) => uri}
        renderItem={({item}: {item: string}) => <StarterPackRow uri={item} />}
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
