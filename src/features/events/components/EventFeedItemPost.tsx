import {useState} from 'react'
import {type StyleProp, StyleSheet, View, type ViewStyle} from 'react-native'
import {AtUri} from '@atproto/syntax'
import {moderatePost, type ModerationDecision} from '@bsky/sdk/moderation'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {useQueryClient} from '@tanstack/react-query'

import {MAX_POST_LINES} from '#/lib/constants'
import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {makeProfileLink} from '#/lib/routes/links'
import {countLines} from '#/lib/strings/helpers'
import {
  POST_TOMBSTONE,
  type Shadow,
  usePostShadow,
} from '#/state/cache/post-shadow'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {unstableCacheProfileView} from '#/state/queries/profile'
import {Link} from '#/view/com/util/Link'
import {PostMeta} from '#/view/com/util/PostMeta'
import {atoms as a, useTheme} from '#/alf'
import {
  GalleryBleed,
  maybeApplyGalleryOffsetStyles,
} from '#/components/images/Gallery'
import {ContentHider} from '#/components/moderation/ContentHider'
import {PostAlerts} from '#/components/moderation/PostAlerts'
import * as ReportDialogMetadataContext from '#/components/moderation/ReportDialog/ReportDialogMetadataContext'
import {Embed, PostEmbedViewContext} from '#/components/Post/Embed'
import {PostRepliedTo} from '#/components/Post/PostRepliedTo'
import {ShowMoreTextButton} from '#/components/Post/ShowMoreTextButton'
import {TranslatedPost} from '#/components/Post/Translated'
import {PostControls} from '#/components/PostControls'
import {RichText} from '#/components/RichText'
import {SubtleHover} from '#/components/SubtleHover'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'

/** Matches the organiser's avatar in `Event.Organizer`. */
const AVATAR_SIZE = 24

/**
 * A post about an event, shown under it in a feed. A copy of `Post` from
 * `#/view/com/post/Post`, but stacked: a small avatar inline with the author's
 * name, and the content below it at full width. Keep the two in step.
 */
export function EventFeedItemPost({
  post,
  hideTopBorder,
  style,
}: {
  post: app.bsky.feed.defs.PostView
  hideTopBorder?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const moderationOpts = useModerationOpts()
  const record = bsky.matches(app.bsky.feed.post, post.record)
    ? post.record
    : undefined
  const postShadowed = usePostShadow(post)
  const richText = record
    ? new RichTextAPI({text: record.text, facets: record.facets})
    : undefined
  const moderation = moderationOpts
    ? moderatePost(post, moderationOpts)
    : undefined

  if (postShadowed === POST_TOMBSTONE) {
    return null
  }
  if (record && richText && moderation) {
    return (
      <ReportDialogMetadataContext.Provider key={postShadowed.uri}>
        <EventFeedItemPostInner
          post={postShadowed}
          record={record}
          richText={richText}
          moderation={moderation}
          hideTopBorder={hideTopBorder}
          style={style}
        />
      </ReportDialogMetadataContext.Provider>
    )
  }
  return null
}

function EventFeedItemPostInner({
  post,
  record,
  richText,
  moderation,
  hideTopBorder,
  style,
}: {
  post: Shadow<app.bsky.feed.defs.PostView>
  record: app.bsky.feed.post.Main
  richText: RichTextAPI
  moderation: ModerationDecision
  hideTopBorder?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const queryClient = useQueryClient()
  const t = useTheme()
  const {openComposer} = useOpenComposer()
  const [limitLines, setLimitLines] = useState(
    () => countLines(richText?.text) >= MAX_POST_LINES,
  )
  const [hover, setHover] = useState(false)
  const itemUrip = new AtUri(post.uri)
  const itemHref = makeProfileLink(post.author, 'post', itemUrip.rkey)
  let replyAuthorDid = ''
  if (record.reply) {
    const urip = new AtUri(record.reply.parent?.uri || record.reply.root.uri)
    replyAuthorDid = urip.hostname
  }

  const onPressReply = () => {
    openComposer({
      replyTo: {
        uri: post.uri,
        cid: post.cid,
        text: record.text,
        author: post.author,
        embed: post.embed,
        moderation,
        langs: record.langs,
      },
      logContext: 'PostReply',
    })
  }

  return (
    <GalleryBleed>
      <Link
        href={itemHref}
        style={[
          styles.outer,
          t.atoms.border_contrast_low,
          !hideTopBorder && a.border_t,
          style,
        ]}
        onBeforePress={() => unstableCacheProfileView(queryClient, post.author)}
        dataSet={{
          keyboardNavigationPost: post.uri,
          keyboardNavigationHref: itemHref,
          keyboardNavigationClickable: 'true',
        }}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}>
        <SubtleHover hover={hover} />
        <View
          style={maybeApplyGalleryOffsetStyles('meta', {
            post,
            modui: moderation.ui('contentList'),
            additionalCauses: [],
          })}>
          <PostMeta
            author={post.author}
            moderation={moderation}
            timestamp={post.indexedAt}
            record={record}
            postHref={itemHref}
            showAvatar
            avatarSize={AVATAR_SIZE}
          />
          {replyAuthorDid !== '' && (
            <PostRepliedTo parentAuthor={replyAuthorDid} />
          )}
          <ContentHider
            modui={moderation.ui('contentView')}
            style={styles.contentHider}
            childContainerStyle={styles.contentHiderChild}>
            <PostAlerts
              post={post}
              modui={moderation.ui('contentView')}
              style={[a.pb_xs]}
            />
            {richText.text ? (
              <View style={[a.mb_2xs]}>
                <RichText
                  enableTags
                  enableCode
                  testID="postText"
                  value={richText}
                  numberOfLines={limitLines ? MAX_POST_LINES : undefined}
                  style={[a.flex_1, a.text_md]}
                  authorHandle={post.author.handle}
                  shouldProxyLinks={true}
                />
                {limitLines && (
                  <ShowMoreTextButton
                    style={[a.text_md]}
                    onPress={() => setLimitLines(false)}
                  />
                )}
              </View>
            ) : undefined}
            <TranslatedPost hideTranslateLink post={post} />
            {post.embed ? (
              <View
                style={maybeApplyGalleryOffsetStyles('embed', {
                  post,
                  modui: moderation.ui('contentList'),
                  additionalCauses: [],
                })}>
                <Embed
                  embed={post.embed}
                  moderation={moderation}
                  viewContext={PostEmbedViewContext.Feed}
                  post={post}
                />
              </View>
            ) : null}
          </ContentHider>
          <PostControls
            post={post}
            record={record}
            richText={richText}
            onPressReply={onPressReply}
            logContext="Post"
          />
        </View>
      </Link>
    </GalleryBleed>
  )
}

const styles = StyleSheet.create({
  outer: {
    paddingTop: 10,
    paddingRight: 15,
    paddingBottom: 5,
    paddingLeft: 15,
    cursor: 'pointer',
  },
  contentHider: {
    marginBottom: 2,
  },
  contentHiderChild: {
    marginTop: 6,
  },
})
