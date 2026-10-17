import {useState} from 'react'
import {View} from 'react-native'
import {AtUri} from '@atproto/syntax'
import {Trans, useLingui} from '@lingui/react/macro'

import {makeCustomFeedLink, makeListLink} from '#/lib/routes/links'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {logger} from '#/logger'
import {useSavedFeeds} from '#/state/queries/feed'
import {useRemoveFeedMutation} from '#/state/queries/preferences'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import * as toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {OsoTitlePill} from '#/features/osoNav/pills'
import {OsoSectionHeader} from '#/features/osoNav/SectionHeader'
import {OsoDiscoverFeeds} from './DiscoverFeeds'
import {OsoFeedTile, OsoFeedTileGrid} from './FeedTiles'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'OsoManageFeeds'>

/**
 * Oso's /manage_feeds: the user's saved feeds as tiles, which "edit" lets
 * them remove, and feeds to discover underneath (as on the explore page).
 */
export function OsoManageFeedsScreen(_props: Props) {
  return (
    <Layout.Screen testID="osoManageFeedsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <OsoTitlePill kind="manageFeeds" />
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <MyFeedsSection />
        <OsoDiscoverFeeds />
        <View style={{height: 100}} />
      </Layout.Content>
    </Layout.Screen>
  )
}

function MyFeedsSection() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {data, isLoading} = useSavedFeeds()
  const {mutateAsync: removeFeed} = useRemoveFeedMutation()
  const [editing, setEditing] = useState(false)
  const feeds = data?.feeds ?? []

  const onRemove = async (id: string, name: string) => {
    try {
      await removeFeed({id})
      toast.show(l`Removed ${name} from your feeds`)
    } catch (e) {
      toast.show(l`Could not remove the feed. Please try again.`, {
        type: 'error',
      })
      logger.error('Oso: failed to remove feed', {safeMessage: e})
    }
  }

  return (
    <View>
      <OsoSectionHeader
        kind="myFeeds"
        right={
          feeds.length > 0 && (
            <Button
              label={editing ? l`Done editing your feeds` : l`Edit your feeds`}
              size="small"
              color="secondary"
              onPress={() => setEditing(!editing)}>
              <ButtonText>
                {editing ? (
                  <Trans context="action">Done</Trans>
                ) : (
                  <Trans context="action">Edit</Trans>
                )}
              </ButtonText>
            </Button>
          )
        }
      />
      {isLoading ? (
        <View style={[a.py_xl, a.align_center]}>
          <Loader size="lg" />
        </View>
      ) : feeds.length === 0 ? (
        <Text style={[a.px_lg, a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>You have not saved any feeds yet.</Trans>
        </Text>
      ) : (
        <OsoFeedTileGrid>
          {feeds.map(feed => {
            if (feed.type === 'timeline') {
              // Following is the home timeline; it stays.
              return (
                <OsoFeedTile
                  key={feed.config.id}
                  name={l({message: 'Following', context: 'feed-name'})}
                  href="/myfeeds"
                />
              )
            }
            const name =
              feed.type === 'feed' ? feed.view.displayName : feed.view.name
            const href =
              feed.type === 'feed'
                ? makeCustomFeedLink(
                    feed.view.creator.did,
                    new AtUri(feed.view.uri).rkey,
                  )
                : makeListLink(
                    feed.view.creator.did,
                    new AtUri(feed.view.uri).rkey,
                  )
            return (
              <OsoFeedTile
                key={feed.config.id}
                name={name}
                avatar={feed.view.avatar}
                href={href}
                action={editing ? 'remove' : undefined}
                actionLabel={l`Remove ${name} from your feeds`}
                onAction={() => void onRemove(feed.config.id, name)}
              />
            )
          })}
        </OsoFeedTileGrid>
      )}
    </View>
  )
}
