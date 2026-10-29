import {View} from 'react-native'
import {AtUri, type AtUriString} from '@atproto/syntax'
import {Trans, useLingui} from '@lingui/react/macro'
import {useQuery} from '@tanstack/react-query'

import {makeCustomFeedLink, makeListLink} from '#/lib/routes/links'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {STALE} from '#/state/queries'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient, useSession} from '#/state/session'
import {PostFeedItem} from '#/view/com/posts/PostFeedItem'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {app} from '#/lexicons'
import {previewPosts} from './items'

/** A live preview of the feed itself, or the starter pack's people-list timeline. */
export function LatestPosts({
  uri,
  kind,
  starterPackUri,
}: {
  uri: AtUriString
  kind: 'feed' | 'list'
  starterPackUri?: AtUriString
}) {
  const client = useAppviewClient()
  const {currentAccount} = useSession()
  const opts = useModerationOpts()
  const {t: l} = useLingui()
  const t = useTheme()
  const parsed = new AtUri(starterPackUri ?? uri)
  const href = starterPackUri
    ? `/starter-pack/${parsed.host}/${parsed.rkey}?view=posts`
    : kind === 'feed'
      ? makeCustomFeedLink(parsed.host, parsed.rkey)
      : makeListLink(parsed.host, parsed.rkey)
  const query = useQuery({
    queryKey: createQueryKey('editorialLatestPosts', {
      uri,
      kind,
      viewer: currentAccount?.did,
    }),
    staleTime: STALE.MINUTES.ONE,
    enabled: !!opts,
    queryFn: () =>
      kind === 'feed'
        ? client.call(app.bsky.feed.getFeed, {feed: uri, limit: 10})
        : client.call(app.bsky.feed.getListFeed, {list: uri, limit: 10}),
  })
  const items = opts ? previewPosts(query.data?.feed ?? [], opts) : []
  return (
    <View testID="editorialLatestPosts" style={[a.w_full]}>
      {query.isPending ? (
        <Loader size="md" />
      ) : query.isError ? (
        <Button
          label={l`Retry loading posts`}
          size="small"
          color="secondary"
          onPress={() => void query.refetch()}>
          <ButtonText>
            <Trans>Retry loading posts</Trans>
          </ButtonText>
        </Button>
      ) : items.length ? (
        items.map(item => (
          <View key={item.post.uri} testID="editorialLatestPost">
            <PostFeedItem
              post={item.post}
              record={item.record}
              moderation={item.moderation}
              reason={item.reason}
              feedContext={item.feedContext}
              reqId={undefined}
              rootPost={item.post}
              parentAuthor={undefined}
              showReplyTo
              hideTopBorder={false}
            />
          </View>
        ))
      ) : (
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>No posts to show.</Trans>
        </Text>
      )}
      {!query.isPending && (
        <View style={[a.align_start, a.pt_sm]}>
          <Link
            testID="editorialShowMore"
            to={href}
            label={l`Show more`}
            color="secondary"
            size="small">
            <ButtonText>
              <Trans>Show more</Trans>
            </ButtonText>
          </Link>
        </View>
      )}
    </View>
  )
}
