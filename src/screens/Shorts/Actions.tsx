import {View} from 'react-native'
import {AtUri} from '@atproto/syntax'
import {type RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {useLingui} from '@lingui/react/macro'

import {makeProfileLink} from '#/lib/routes/links'
import {type Shadow} from '#/state/cache/post-shadow'
import {atoms as a, web} from '#/alf'
import {Bubble_Stroke2_Corner2_Rounded as Comment} from '#/components/icons/Bubble'
import {useLink} from '#/components/Link'
import {BookmarkButton} from '#/components/PostControls/BookmarkButton'
import {
  PostControlButton,
  PostControlButtonIcon,
  PostControlButtonProvider,
  PostControlButtonText,
} from '#/components/PostControls/PostControlButton'
import {PostMenuButton} from '#/components/PostControls/PostMenu'
import {ShareMenuButton} from '#/components/PostControls/ShareMenu'
import {useFormatPostStatCount} from '#/components/PostControls/util'
import {ArticleLikeButton} from '#/features/articles/LikeButton'
import {type app} from '#/lexicons'

/** Shared mutations and menus, presented consistently over video. */
export function ShortsActions({
  post,
  record,
  richText,
}: {
  post: Shadow<app.bsky.feed.defs.PostView>
  record: app.bsky.feed.post.Main
  richText: RichTextAPI
}) {
  return (
    <PostControlButtonProvider presentation="overlay">
      <View
        testID="shortsActions"
        style={[
          a.absolute,
          a.align_center,
          a.gap_md,
          {right: 12, bottom: 130},
        ]}>
        <ArticleLikeButton post={post} vertical />
        <CommentsLink post={post} />
        <BookmarkButton post={post} logContext="ImmersiveVideo" />
        <ShareMenuButton
          testID="shortsShare"
          post={post}
          record={record}
          richText={richText}
          timestamp={record.createdAt}
          onShare={() => {}}
          logContext="ImmersiveVideo"
        />
        <PostMenuButton
          testID="shortsMenu"
          post={post}
          postFeedContext={undefined}
          postReqId={undefined}
          record={record}
          richText={richText}
          timestamp={record.createdAt}
          logContext="ImmersiveVideo"
          forceGoogleTranslate={false}
        />
      </View>
    </PostControlButtonProvider>
  )
}

function CommentsLink({post}: {post: Shadow<app.bsky.feed.defs.PostView>}) {
  const {t: l} = useLingui()
  const formatCount = useFormatPostStatCount()
  const {href, onPress} = useLink({
    to: makeProfileLink(post.author, 'post', new AtUri(post.uri).rkey),
    displayText: '',
  })
  return (
    <PostControlButton
      testID="shortsComments"
      href={href}
      role="link"
      accessibilityRole="link"
      label={l`Open conversation`}
      onPress={onPress}
      {...web({dataSet: {noUnderline: '1'}})}>
      <PostControlButtonIcon icon={Comment} />
      <PostControlButtonText>
        {formatCount(post.replyCount ?? 0)}
      </PostControlButtonText>
    </PostControlButton>
  )
}
