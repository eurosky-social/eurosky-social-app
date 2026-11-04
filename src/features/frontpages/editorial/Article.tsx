import {View} from 'react-native'
import {Image} from 'expo-image'
import {AtUri} from '@atproto/syntax'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {makeProfileLink} from '#/lib/routes/links'
import {POST_TOMBSTONE, usePostShadow} from '#/state/cache/post-shadow'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {ButtonIcon, ButtonText} from '#/components/Button'
import {Bubble_Stroke2_Corner2_Rounded as Comment} from '#/components/icons/Bubble'
import {Heart2_Stroke2_Corner0_Rounded as Like} from '#/components/icons/Heart2'
import {Repost_Stroke2_Corner0_Rounded as Repost} from '#/components/icons/Repost'
import {Link} from '#/components/Link'
import {ContentHider} from '#/components/moderation/ContentHider'
import {Embed} from '#/components/Post/Embed'
import {ImageEmbed} from '#/components/Post/Embed/ImageEmbed'
import {PostEmbedViewContext} from '#/components/Post/Embed/types'
import {VideoEmbed} from '#/components/Post/Embed/VideoEmbed'
import {useFormatPostStatCount} from '#/components/PostControls/util'
import {RichText} from '#/components/RichText'
import {Text} from '#/components/Typography'
import {type EditorialArticle} from './articles'
import {type ArticleSize} from './curation'
import {articleModeration} from './moderation'

/** A newspaper story, with the original article and its social thread kept separate. */
export function Article({
  article,
  lead = false,
  compact = false,
  wide = false,
  size,
  controls,
  muted = false,
  card = false,
}: {
  article: EditorialArticle
  lead?: boolean
  compact?: boolean
  wide?: boolean
  size?: ArticleSize
  controls?: React.ReactNode
  /** Greyed out, for an automatic story in the editor; its controls are not. */
  muted?: boolean
  /** A carousel card: the picture above the headline, whatever the screen. */
  card?: boolean
}) {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const formatPostStatCount = useFormatPostStatCount()
  const {t: l, i18n} = useLingui()
  const moderationOpts = useModerationOpts()
  const {item} = article
  const post = usePostShadow(item.post)
  if (post === POST_TOMBSTONE) return null

  const modui = articleModeration(article, moderationOpts)
  if (modui.filter) return null

  const commentCount = post.replyCount ?? 0
  const likeCount = post.likeCount ?? 0
  const repostCount = post.repostCount ?? 0
  const likesLabel = plural(likeCount, {
    one: 'View # like',
    other: 'View # likes',
  })
  const repostsLabel = plural(repostCount, {
    one: 'View # repost',
    other: 'View # reposts',
  })
  const commentsLabel = plural(commentCount, {
    one: 'Open conversation (# comment)',
    other: 'Open conversation (# comments)',
  })
  const thread = makeProfileLink(post.author, 'post', new AtUri(post.uri).rkey)
  const date = new Date(item.record.createdAt)
  const published = Number.isNaN(date.getTime())
    ? undefined
    : i18n.date(date, {month: 'short', day: 'numeric'})
  const social = !article.external || !!article.quote
  const mobileCompact =
    !card && !gtMobile && !social && !lead && size === 'small'
  const bodySize = lead || size === 'big' ? 20 : size === 'medium' ? 18 : 16
  const headlineSize = mobileCompact
    ? 18
    : social
      ? 20
      : lead || size === 'big'
        ? wide
          ? 40
          : 30
        : size === 'medium'
          ? 30
          : compact
            ? 21
            : 26

  return (
    <ContentHider modui={modui} testID="editorialArticle">
      <View
        style={[
          a.gap_md,
          !!controls &&
            (social || mobileCompact || !article.image) && {paddingTop: 56},
        ]}>
        {controls}
        <View
          testID={muted ? 'editorialArticleMuted' : undefined}
          style={[
            a.gap_md,
            /* An automatic story in the editor: faded and, on web, grey. */
            muted && [{opacity: 0.45}, web({filter: 'grayscale(1)'})],
          ]}>
          {social && !!item.record.text.trim() && (
            <RichText
              testID="editorialPostText"
              value={
                new RichTextAPI({
                  text: item.record.text,
                  facets: item.record.facets,
                })
              }
              enableTags
              enableCode
              authorHandle={post.author.handle}
              shouldProxyLinks
              style={[{fontSize: bodySize, lineHeight: bodySize * 1.5}]}
            />
          )}
          {article.media?.type === 'video' ? (
            <VideoEmbed embed={article.media.view} post={post} />
          ) : article.media ? (
            <ImageEmbed
              embed={article.media}
              imageLayout="carousel"
              post={post}
              viewContext={PostEmbedViewContext.Feed}
              style={[a.mt_0]}
            />
          ) : null}
          {(!social || !!article.external) && (
            <Link
              testID="editorialStoryLink"
              to={article.url || thread}
              label={article.title}
              style={[
                a.w_full,
                mobileCompact ? a.flex_row : a.flex_col,
                mobileCompact ? a.align_center : a.align_start,
                a.gap_md,
              ]}>
              {!article.media && !!article.image && (
                <Image
                  source={{uri: article.image}}
                  accessibilityLabel={article.imageAlt}
                  accessibilityHint={l`Opens the article`}
                  accessibilityIgnoresInvertColors
                  style={[
                    mobileCompact
                      ? {width: 88, height: 72, flexShrink: 0}
                      : a.w_full,
                    !mobileCompact && {
                      aspectRatio:
                        size === 'big'
                          ? 16 / 9
                          : lead || size === 'medium'
                            ? 3 / 2
                            : 16 / 10,
                    },
                  ]}
                  contentFit="cover"
                  transition={150}
                />
              )}
              <Text
                emoji
                accessibilityRole="header"
                numberOfLines={mobileCompact ? 3 : undefined}
                style={[
                  mobileCompact && a.flex_1,
                  a.font_bold,
                  t.atoms.text,
                  {
                    fontSize: headlineSize,
                    lineHeight: headlineSize * 1.1,
                    letterSpacing: -0.7,
                  },
                ]}>
                {article.title}
              </Text>
              {!compact && !mobileCompact && !!article.description && (
                <Text
                  emoji
                  numberOfLines={lead ? 4 : 3}
                  style={[
                    a.text_md,
                    a.leading_relaxed,
                    t.atoms.text_contrast_medium,
                  ]}>
                  {article.description}
                </Text>
              )}
            </Link>
          )}
          {!!article.quote && (
            <Embed
              embed={article.quote}
              post={post}
              moderation={item.moderation}
              viewContext={PostEmbedViewContext.Feed}
              style={[a.mt_0]}
            />
          )}
          <View
            testID="editorialPostStats"
            style={[a.flex_row, a.flex_wrap, a.align_center, a.gap_sm]}>
            {!!published && (
              <Text
                testID="editorialPostDate"
                style={[a.text_xs, t.atoms.text_contrast_medium]}>
                {published}
              </Text>
            )}
            <Link
              testID="editorialComments"
              to={thread}
              label={commentsLabel}
              color="secondary"
              variant="ghost"
              size="small">
              <ButtonIcon icon={Comment} />
              <ButtonText>{formatPostStatCount(commentCount)}</ButtonText>
            </Link>
            <Link
              testID="editorialReposts"
              to={`${thread}/reposted-by`}
              label={repostsLabel}
              color="secondary"
              variant="ghost"
              size="small">
              <ButtonIcon icon={Repost} />
              <ButtonText>{formatPostStatCount(repostCount)}</ButtonText>
            </Link>
            <Link
              testID="editorialLikes"
              to={`${thread}/liked-by`}
              label={likesLabel}
              color="secondary"
              variant="ghost"
              size="small">
              <ButtonIcon icon={Like} />
              <ButtonText>{formatPostStatCount(likeCount)}</ButtonText>
            </Link>
          </View>
        </View>
      </View>
    </ContentHider>
  )
}
