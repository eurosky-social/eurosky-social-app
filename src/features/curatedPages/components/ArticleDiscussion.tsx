import {Fragment} from 'react'
import {View} from 'react-native'
import {type AppBskyFeedDefs, type AppBskyFeedPost} from '@atproto/api'
import {plural} from '@lingui/core/macro'
import {Trans} from '@lingui/react/macro'

import {sanitizeHandle} from '#/lib/strings/handles'
import {postUriToRelativePath} from '#/lib/strings/url-helpers'
import {PreviewableUserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Divider} from '#/components/Divider'
import {Bubble_Stroke2_Corner2_Rounded as Bubble} from '#/components/icons/Bubble'
import {Heart2_Stroke2_Corner0_Rounded as Heart} from '#/components/icons/Heart2'
import {Repost_Stroke2_Corner2_Rounded as Repost} from '#/components/icons/Repost'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {useArticleDiscussionQuery} from '../queries'

const SHOWN = 3

/**
 * The in-network conversation about one article: real posts that linked it,
 * shown beneath the hero. Tapping through lands in the live thread. This is the
 * connection the home feed and the publisher's own site don't make.
 */
export function ArticleDiscussion({url}: {url: string}) {
  const t = useTheme()
  const {data, isLoading} = useArticleDiscussionQuery({url})

  // Stay quiet until there's something real to show - no loaders or empty shells
  // cluttering the front page.
  if (isLoading || !data?.posts.length) return null

  const posts = data.posts.slice(0, SHOWN)

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
      <Text style={[a.text_xs, a.font_bold, t.atoms.text_contrast_medium]}>
        <Trans>The Atmosphere on this story</Trans>
      </Text>

      {posts.map((post, i) => (
        <Fragment key={post.uri}>
          {i > 0 && <Divider />}
          <DiscussionPost post={post} />
        </Fragment>
      ))}

      <Link
        to={`/search?q=${encodeURIComponent(url)}`}
        label={`See all posts about this article`}
        style={[a.self_start]}>
        <Text style={[a.text_sm, a.font_bold, {color: t.palette.primary_500}]}>
          {data.total > SHOWN ? (
            <Trans>
              See all {plural(data.total, {one: '# post', other: '# posts'})}
            </Trans>
          ) : (
            <Trans>See the conversation</Trans>
          )}
        </Text>
      </Link>
    </View>
  )
}

function DiscussionPost({post}: {post: AppBskyFeedDefs.PostView}) {
  const t = useTheme()
  const author = post.author
  const record = post.record as AppBskyFeedPost.Record
  const text = typeof record.text === 'string' ? record.text : ''
  const path = postUriToRelativePath(post.uri, {handle: author.handle})

  const body = (
    <View style={[a.flex_row, a.gap_sm, a.w_full]}>
      <PreviewableUserAvatar profile={author} size={28} />
      <View style={[a.flex_1, a.gap_2xs]}>
        <Text
          emoji
          numberOfLines={1}
          style={[a.text_sm, a.font_bold, t.atoms.text]}>
          {author.displayName || sanitizeHandle(author.handle)}
        </Text>
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
      </View>
    </View>
  )

  if (!path) return body
  return (
    <Link to={path} label={text || author.handle} style={[a.flex_col]}>
      {body}
    </Link>
  )
}

function hasEngagement(post: AppBskyFeedDefs.PostView): boolean {
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
  // Skip stats with no count so a post shows only the engagement it actually has.
  if (!value) return null
  return (
    <View style={[a.flex_row, a.align_center, a.gap_xs]}>
      <Icon size="xs" fill={t.atoms.text_contrast_low.color} />
      <Text style={[a.text_xs, t.atoms.text_contrast_low]}>
        {value.toLocaleString()}
      </Text>
    </View>
  )
}
