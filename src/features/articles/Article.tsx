import {View} from 'react-native'
import {Image} from 'expo-image'
import {AtUri} from '@atproto/syntax'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {makeProfileLink} from '#/lib/routes/links'
import {toNiceDomain} from '#/lib/strings/url-helpers'
import {
  POST_TOMBSTONE,
  type Shadow,
  usePostShadow,
} from '#/state/cache/post-shadow'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {ButtonIcon, ButtonText} from '#/components/Button'
import {Bubble_Stroke2_Corner2_Rounded as Comment} from '#/components/icons/Bubble'
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
import {type app} from '#/lexicons'
import {type PostArticle} from './articles'
import {type ArticleSize} from './articles'
import {hasDistinctArticleCaption} from './articleText'
import {ArticleLikeButton} from './LikeButton'
import {articleModeration} from './moderation'

type ArticleProps = {
  article: PostArticle
  lead?: boolean
  compact?: boolean
  wide?: boolean
  size?: ArticleSize
  controls?: React.ReactNode
  /** Faded automatic story in the editor; its controls remain active. */
  muted?: boolean
  /** Carousel card with its picture above the headline on all screens. */
  card?: boolean
  presentation?: 'preview' | 'thread'
  showStats?: boolean
  onOpen?: () => void
}

/** A newspaper story, with the original article and its social thread kept separate. */
export function Article(props: ArticleProps) {
  const opts = useModerationOpts()
  const post = usePostShadow(props.article.item.post)
  if (post === POST_TOMBSTONE) return null
  const modui = articleModeration(props.article, opts)
  if (modui.filter) return null
  return (
    <ContentHider modui={modui} testID="editorialArticle">
      <ArticleContent {...props} post={post} />
    </ContentHider>
  )
}

/** Body only: thread callers supply their existing shadow/deletion and moderation boundary. */
export function ArticleContent({
  article,
  lead = false,
  compact = false,
  wide = false,
  size,
  controls,
  muted = false,
  card = false,
  post,
  presentation = 'preview',
  showStats = presentation !== 'thread',
  onOpen,
}: ArticleProps & {post: Shadow<app.bsky.feed.defs.PostView>}) {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const formatPostStatCount = useFormatPostStatCount()
  const {t: l, i18n} = useLingui()
  const {item} = article
  const viewContext =
    presentation === 'thread'
      ? PostEmbedViewContext.ThreadHighlighted
      : PostEmbedViewContext.Feed
  const commentCount = post.replyCount ?? 0
  const repostCount = post.repostCount ?? 0
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
  const hasHeadline = !!article.external?.title.trim()
  const social = !hasHeadline || !!article.quote
  const linkTitle = hasHeadline
    ? article.title
    : article.url
      ? toNiceDomain(article.url).replace(/^www\./, '')
      : article.title
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

  const postText = !!item.record.text.trim() && (
    <RichText
      testID="editorialPostText"
      value={
        new RichTextAPI({text: item.record.text, facets: item.record.facets})
      }
      enableTags
      enableCode
      selectable={presentation === 'thread'}
      authorHandle={post.author.handle}
      shouldProxyLinks
      style={[
        a.w_full,
        {minWidth: 0, fontSize: bodySize, lineHeight: bodySize * 1.5},
        web({overflowWrap: 'anywhere'}),
      ]}
    />
  )
  return (
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
        {social && postText}
        {article.media?.type === 'video' ? (
          <VideoEmbed embed={article.media.view} post={post} />
        ) : article.media ? (
          <ImageEmbed
            embed={article.media}
            imageLayout="carousel"
            post={post}
            viewContext={viewContext}
            style={[a.mt_0]}
          />
        ) : null}
        {(!social || !!article.external) && (
          <Link
            testID="editorialStoryLink"
            to={article.url || thread}
            label={linkTitle}
            onPress={onOpen}
            style={[
              a.w_full,
              {minWidth: 0},
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
              testID="articleHeadline"
              accessibilityRole={hasHeadline ? 'header' : undefined}
              numberOfLines={mobileCompact ? 3 : undefined}
              style={[
                mobileCompact ? a.flex_1 : a.w_full,
                {minWidth: 0},
                a.flex_shrink,
                hasHeadline && a.font_bold,
                hasHeadline ? t.atoms.text : t.atoms.text_contrast_medium,
                web({overflowWrap: 'anywhere'}),
                {
                  fontSize: hasHeadline ? headlineSize : 14,
                  lineHeight: hasHeadline ? headlineSize * 1.1 : 20,
                  letterSpacing: hasHeadline ? -0.7 : 0,
                },
              ]}>
              {linkTitle}
            </Text>
            {hasHeadline &&
              !compact &&
              !mobileCompact &&
              !!article.description && (
                <Text
                  emoji
                  numberOfLines={
                    presentation === 'thread' ? undefined : lead ? 4 : 3
                  }
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
        {presentation === 'thread' &&
          !social &&
          hasDistinctArticleCaption(article) &&
          postText}
        {!!article.quote && (
          <Embed
            embed={article.quote}
            post={post}
            moderation={item.moderation}
            viewContext={viewContext}
            onOpen={onOpen}
            style={[a.mt_0]}
          />
        )}
        {showStats && (
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
            <ArticleLikeButton post={post} />
          </View>
        )}
      </View>
    </View>
  )
}
