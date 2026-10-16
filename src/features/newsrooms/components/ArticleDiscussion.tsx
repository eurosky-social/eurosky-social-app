import {Fragment} from 'react'
import {View} from 'react-native'
import {moderatePost, type ModerationDecision} from '@bsky/sdk/moderation'
import {Plural, Trans, useLingui} from '@lingui/react/macro'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {postUriToRelativePath} from '#/lib/strings/url-helpers'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {PreviewableUserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {Divider} from '#/components/Divider'
import {Bubble_Stroke2_Corner2_Rounded as Bubble} from '#/components/icons/Bubble'
import {Heart2_Stroke2_Corner0_Rounded as Heart} from '#/components/icons/Heart2'
import {Repost_Stroke2_Corner2_Rounded as Repost} from '#/components/icons/Repost'
import {Link} from '#/components/Link'
import {ContentHider} from '#/components/moderation/ContentHider'
import {PostAlerts} from '#/components/moderation/PostAlerts'
import {Text} from '#/components/Typography'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {articleSearchPath} from '../discussion'
import {useArticleDiscussionQuery} from '../queries'
import {toSingleParagraph} from '../text'

const SHOWN = 3

/**
 * The in-network conversation about one article: real posts that linked it,
 * shown beneath the hero. Tapping through lands in the live thread. This is the
 * connection the home feed and the publisher's own site don't make.
 */
export function ArticleDiscussion({
  url,
  publisherDid,
}: {
  url: string
  publisherDid?: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const moderationOpts = useModerationOpts()
  const {openComposer} = useOpenComposer()
  const {data, isLoading} = useArticleDiscussionQuery({url, publisherDid})

  /*
   * Stay quiet until there is something real and safe to show. Search results
   * do not apply the app's moderation preferences for us.
   */
  if (isLoading || !data?.posts.length || !moderationOpts) return null

  const moderatedPosts = data.posts
    .map(post => ({post, moderation: moderatePost(post, moderationOpts)}))
    .filter(({moderation}) => !moderation.ui('contentList').filter)
  const posts = moderatedPosts.slice(0, SHOWN)
  if (!posts.length) return null

  // The publisher's own post of the article is its canonical thread; joining
  // the conversation replies there, unless moderation filtered it.
  const visibleAnchor = data.anchor
    ? moderatedPosts.find(({post}) => post.uri === data.anchor?.uri)
    : undefined
  const anchorPath = visibleAnchor
    ? postUriToRelativePath(visibleAnchor.post.uri, {
        handle: visibleAnchor.post.author.handle,
      })
    : undefined

  /*
   * A thread gate on the canonical thread would reject the reply after the
   * composer had already taken it, so offer reading the thread instead.
   */
  const canReply = !!visibleAnchor && !visibleAnchor.post.viewer?.replyDisabled
  const showAnchorActions = canReply || !!anchorPath

  // "Join the conversation" opens the composer as a reply to the canonical
  // thread, so joining grows the one conversation instead of starting another.
  function onJoinConversation() {
    if (!visibleAnchor) return
    const {post, moderation} = visibleAnchor
    if (!bsky.isType(app.bsky.feed.post, post.record)) return
    const record = post.record
    openComposer({
      replyTo: {
        uri: post.uri,
        cid: post.cid,
        text: typeof record.text === 'string' ? record.text : '',
        author: post.author,
        embed: post.embed,
        moderation,
        langs: record.langs,
      },
      logContext: 'PostReply',
    })
  }

  return (
    <View
      style={[
        a.mt_xs,
        a.rounded_md,
        a.border,
        a.p_md,
        a.gap_md,
        t.atoms.border_contrast_low,
        t.atoms.bg_contrast_25,
      ]}>
      {/* The header is the door to the full conversation: every post that
          features this article, not just the few shown here. */}
      <Link
        to={articleSearchPath(url)}
        label={l`See all posts featuring this article`}
        style={[a.self_start]}>
        <Text style={[a.text_xs, a.font_bold, t.atoms.text_contrast_medium]}>
          <Trans>This story in the Atmosphere</Trans>
        </Text>
      </Link>

      {posts.map(({post, moderation}, i) => (
        <Fragment key={post.uri}>
          {i > 0 && <Divider />}
          <DiscussionPost post={post} moderation={moderation} />
        </Fragment>
      ))}

      {showAnchorActions ? (
        <View style={[a.flex_row, a.align_center, a.gap_lg]}>
          {canReply && (
            <Button
              label={l`Reply to the discussion thread`}
              onPress={onJoinConversation}
              style={[a.self_start]}>
              <Text
                style={[
                  a.text_sm,
                  a.font_bold,
                  {color: t.palette.primary_500},
                ]}>
                <Trans>Join the conversation</Trans>
              </Text>
            </Button>
          )}
          {/* Composing is the primary action where it is open to us; otherwise
              reading the canonical thread is all that is left. */}
          {anchorPath && (
            <Link
              to={anchorPath}
              label={l`Open the discussion thread`}
              style={[a.self_start]}>
              <Text
                style={[
                  a.text_sm,
                  a.font_bold,
                  canReply
                    ? t.atoms.text_contrast_medium
                    : {color: t.palette.primary_500},
                ]}>
                <Trans>Open the thread</Trans>
              </Text>
            </Link>
          )}
        </View>
      ) : (
        <Link
          to={articleSearchPath(url)}
          label={l`See all posts featuring this article`}
          style={[a.self_start]}>
          <Text
            style={[a.text_sm, a.font_bold, {color: t.palette.primary_500}]}>
            {data.total > SHOWN ? (
              <Trans>
                See all{' '}
                <Plural value={data.total} one="# post" other="# posts" />
              </Trans>
            ) : (
              <Trans>See the conversation</Trans>
            )}
          </Text>
        </Link>
      )}
    </View>
  )
}

export function DiscussionPost({
  post,
  moderation,
}: {
  post: app.bsky.feed.defs.PostView
  moderation: ModerationDecision
}) {
  const t = useTheme()
  const author = post.author
  const record = bsky.isType(app.bsky.feed.post, post.record)
    ? post.record
    : undefined
  const text = record ? toSingleParagraph(record.text) : ''
  const path = postUriToRelativePath(post.uri, {handle: author.handle})
  const contentModui = moderation.ui('contentView')
  const displayName = sanitizeDisplayName(
    author.displayName || sanitizeHandle(author.handle),
    moderation.ui('displayName'),
  )
  const linkLabel = contentModui.blurs.length
    ? author.handle
    : text || author.handle

  const body = (
    <View style={[a.flex_row, a.gap_sm, a.w_full]}>
      <PreviewableUserAvatar
        profile={author}
        moderation={moderation.ui('avatar')}
        size={28}
      />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text
          emoji
          numberOfLines={1}
          style={[a.text_sm, a.font_bold, t.atoms.text]}>
          {displayName}
        </Text>
        <ContentHider modui={contentModui} childContainerStyle={[a.gap_2xs]}>
          <PostAlerts modui={contentModui} />
          {!!text && (
            <Text
              emoji
              numberOfLines={3}
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_high]}>
              {text}
            </Text>
          )}
          {hasEngagement(post) && (
            <View style={[a.flex_row, a.gap_md, a.pt_2xs]}>
              <Stat icon={Repost} value={post.repostCount} />
              <Stat icon={Heart} value={post.likeCount} />
              <Stat icon={Bubble} value={post.replyCount} />
            </View>
          )}
        </ContentHider>
      </View>
    </View>
  )

  if (!path) return body
  return (
    <Link to={path} label={linkLabel} style={[a.flex_col]}>
      {body}
    </Link>
  )
}

// Only the counts the row actually renders, so it is never an empty padded row.
function hasEngagement(post: app.bsky.feed.defs.PostView): boolean {
  return !!(post.repostCount || post.likeCount || post.replyCount)
}

function Stat({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{size?: 'xs' | 'sm'; fill?: string}>
  value?: number
}) {
  const t = useTheme()
  const {i18n} = useLingui()
  // Skip stats with no count so a post shows only the engagement it actually has.
  if (!value) return null
  return (
    <View style={[a.flex_row, a.align_center, a.gap_xs]}>
      <Icon size="xs" fill={t.atoms.text_contrast_low.color} />
      <Text style={[a.text_xs, t.atoms.text_contrast_low]}>
        {i18n.number(value)}
      </Text>
    </View>
  )
}
