import {useState} from 'react'
import {View} from 'react-native'
import {AtUri} from '@atproto/syntax'
import {Trans, useLingui} from '@lingui/react/macro'

import {makeCustomFeedLink} from '#/lib/routes/links'
import {logger} from '#/logger'
import {useGetPopularFeedsQuery} from '#/state/queries/feed'
import {useAddSavedFeedsMutation} from '#/state/queries/preferences'
import {atoms as a, useTheme} from '#/alf'
import {Loader} from '#/components/Loader'
import * as toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {OsoSectionHeader} from '#/features/osoNav/SectionHeader'
import {OsoFeedTile, OsoFeedTileGrid} from './FeedTiles'

/** The most feeds the discover section shows. */
const MAX_FEEDS = 16

/**
 * The "discover" section: popular feeds the user has not saved yet, as tiles
 * with a plus that adds the feed to their feeds (pinned, so it shows on
 * /myfeeds). Used on the explore and manage feeds pages.
 */
export function OsoDiscoverFeeds() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {data, isLoading, error} = useGetPopularFeedsQuery({limit: MAX_FEEDS})
  const {mutateAsync: addSavedFeeds} = useAddSavedFeedsMutation()
  /*
   * Added feeds drop out of the list once preferences refetch; until then
   * their tile shows a tick instead of the plus.
   */
  const [added, setAdded] = useState<Set<string>>(new Set())

  const feeds = (data?.pages.flatMap(page => page.feeds) ?? []).slice(
    0,
    MAX_FEEDS,
  )

  const onAdd = async (uri: string, name: string) => {
    setAdded(prev => new Set(prev).add(uri))
    try {
      await addSavedFeeds([{type: 'feed', value: uri, pinned: true}])
      toast.show(l`Added ${name} to your feeds`)
    } catch (e) {
      setAdded(prev => {
        const next = new Set(prev)
        next.delete(uri)
        return next
      })
      toast.show(l`Could not add the feed. Please try again.`, {
        type: 'error',
      })
      logger.error('Oso: failed to add feed', {safeMessage: e})
    }
  }

  return (
    <View>
      <OsoSectionHeader kind="discover" />
      {isLoading ? (
        <View style={[a.py_xl, a.align_center]}>
          <Loader size="lg" />
        </View>
      ) : error || feeds.length === 0 ? (
        <Text style={[a.px_lg, a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>No feeds to discover right now.</Trans>
        </Text>
      ) : (
        <OsoFeedTileGrid>
          {feeds.map(feed => {
            const isAdded = added.has(feed.uri)
            return (
              <OsoFeedTile
                key={feed.uri}
                name={feed.displayName}
                avatar={feed.avatar}
                href={makeCustomFeedLink(
                  feed.creator.did,
                  new AtUri(feed.uri).rkey,
                )}
                action={isAdded ? 'added' : 'add'}
                actionLabel={
                  isAdded
                    ? l`${feed.displayName} added`
                    : l`Add ${feed.displayName} to your feeds`
                }
                onAction={() => void onAdd(feed.uri, feed.displayName)}
              />
            )
          })}
        </OsoFeedTileGrid>
      )}
    </View>
  )
}
