import {View} from 'react-native'
import {
  mergeModUIResults,
  moderateFeedGenerator,
  moderateProfile,
  moderateUserList,
  type ModerationOpts,
} from '@bsky/sdk/moderation'
import {Trans, useLingui} from '@lingui/react/macro'
import {useQuery} from '@tanstack/react-query'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient, useSession} from '#/state/session'
import {atoms as a} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Default as FeedCard} from '#/components/FeedCard'
import {Loader} from '#/components/Loader'
import {ContentHider} from '#/components/moderation/ContentHider'
import {Text} from '#/components/Typography'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {type StarterPackViewMode} from './curation'
import {feedItem, type ResourceItem, starterPackItem} from './items'
import {LatestPosts} from './LatestPosts'
import {StarterPackHeader} from './StarterPackHeader'
import {StarterPackPeople} from './StarterPackPeople'

export function resourceModeration(item: ResourceItem, opts: ModerationOpts) {
  if (item.feed) {
    const decision = moderateFeedGenerator(item.feed, opts)
    return mergeModUIResults(
      decision.ui('contentList'),
      decision.ui('contentView'),
      decision.ui('avatar'),
    )
  }
  if (item.starterPack) {
    const pack = item.starterPack
    /* The SDK has no starter-pack decision; apply reference-list content policy to its labels. */
    const content = moderateUserList(
      {
        uri: pack.uri,
        cid: pack.cid,
        name: item.title,
        purpose: 'app.bsky.graph.defs#referencelist',
        labels: pack.labels,
        creator: {...pack.creator, $type: undefined},
        indexedAt: pack.indexedAt,
      },
      opts,
    )
    return mergeModUIResults(
      moderateProfile(pack.creator, opts).ui('profileView'),
      content.ui('contentList'),
      content.ui('contentView'),
    )
  }
}

/** Use the app's regular feed and starter-pack cards and destinations, not article-shaped imitations. */
export function ResourceSlot({
  item,
  controls,
  starterPackMode = 'people',
}: {
  item: ResourceItem
  controls?: React.ReactNode
  starterPackMode?: StarterPackViewMode
}) {
  const client = useAppviewClient()
  const {currentAccount} = useSession()
  const opts = useModerationOpts()
  const {t: l} = useLingui()
  const query = useQuery({
    queryKey: createQueryKey('editorialResource', {
      uri: item.item.uri,
      viewer: currentAccount?.did,
    }),
    staleTime: STALE.MINUTES.ONE,
    initialData: item.feed ? item : undefined,
    placeholderData: item.starterPack ? item : undefined,
    async queryFn() {
      if (item.kind === 'feed')
        return feedItem(
          (
            await client.call(app.bsky.feed.getFeedGenerator, {
              feed: item.item.uri,
            })
          ).view,
        )
      const pack = starterPackItem(
        (
          await client.call(app.bsky.graph.getStarterPack, {
            starterPack: item.item.uri,
          })
        ).starterPack,
      )
      if (!pack) throw new Error('Invalid starter pack')
      return pack
    },
  })
  const modui =
    query.data && opts ? resourceModeration(query.data, opts) : undefined
  if (modui?.filter) return null
  return (
    <ContentHider modui={modui} testID="editorialResourceSlot">
      <View style={[a.relative, a.gap_md, !!controls && {paddingTop: 56}]}>
        {controls}
        {query.isPending ? (
          <Loader size="lg" />
        ) : query.data?.feed ? (
          <View style={[a.gap_lg]}>
            <FeedCard view={query.data.feed} />
            <LatestPosts kind="feed" uri={query.data.feed.uri} />
          </View>
        ) : query.data?.starterPack ? (
          <View style={[a.gap_lg]}>
            <StarterPackHeader
              pack={query.data.starterPack}
              disabled={query.isPlaceholderData}
            />
            {query.isPlaceholderData ? (
              <Loader size="md" />
            ) : starterPackMode === 'posts' &&
              bsky.matches(
                app.bsky.graph.starterpack,
                query.data.starterPack.record,
              ) ? (
              <LatestPosts
                kind="list"
                uri={query.data.starterPack.record.list}
                starterPackUri={query.data.starterPack.uri}
              />
            ) : (
              <StarterPackPeople pack={query.data.starterPack} />
            )}
          </View>
        ) : (
          <View style={[a.gap_sm]}>
            <Text>
              <Trans>Couldn’t load this slot.</Trans>
            </Text>
            <Button
              label={l`Try again`}
              size="small"
              color="secondary"
              onPress={() => void query.refetch()}>
              <ButtonText>
                <Trans>Try again</Trans>
              </ButtonText>
            </Button>
          </View>
        )}
      </View>
    </ContentHider>
  )
}
