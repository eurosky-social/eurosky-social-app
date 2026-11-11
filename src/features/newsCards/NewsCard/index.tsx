import {useState} from 'react'
import {View} from 'react-native'
import {AtUri} from '@atproto/syntax'
import {plural} from '@lingui/core/macro'
import {useLingui} from '@lingui/react/macro'

import {makeProfileLink} from '#/lib/routes/links'
import {
  POST_TOMBSTONE,
  type Shadow,
  usePostShadow,
} from '#/state/cache/post-shadow'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {atoms as a, useTheme, web} from '#/alf'
import {Link} from '#/components/Link'
import {ContentHider} from '#/components/moderation/ContentHider'
import {Text} from '#/components/Typography'
import {type PostArticle} from '#/features/articles/articles'
import {articleModeration} from '#/features/articles/moderation'
import {findPublisherByDid} from '#/features/publishers/publishers'
import {type app} from '#/lexicons'
import {cardAccessibleName, cardHasMedia, cardKind, cardTopic} from '../model'
import {type CardSize} from '../slotting'
import {CardActions, useCardTime} from './CardActions'
import {Kicker} from './Kicker'
import {Media} from './Media'
import {
  HEADLINE,
  STANDFIRST_LINES,
  STANDFIRST_SIZE,
  TEXT_POST_HEADLINE,
} from './styles'

/** One front-page story at a given slot size. */
export function NewsCard({
  article,
  size,
}: {
  article: PostArticle
  size: CardSize
}) {
  const opts = useModerationOpts()
  const post = usePostShadow(article.item.post)
  if (post === POST_TOMBSTONE) return null
  const moderation = articleModeration(article, opts)
  if (moderation.filter) return null
  return (
    <NewsCardInner
      article={article}
      size={size}
      post={post}
      moderation={moderation}
    />
  )
}

function NewsCardInner({
  article,
  size,
  post,
  moderation,
}: {
  article: PostArticle
  size: CardSize
  post: Shadow<app.bsky.feed.defs.PostView>
  moderation: ReturnType<typeof articleModeration>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const opts = useModerationOpts()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [pressed, setPressed] = useState(false)
  const time = useCardTime(article.item.record.createdAt)

  const kind = cardKind(article)
  const hasMedia = cardHasMedia(article)
  const topic = cardTopic(article.item.record)
  const format =
    kind === 'youtube' ? 'YouTube' : kind === 'video' ? l`Video` : undefined
  const publisher = findPublisherByDid(post.author.did)
  const publisherName =
    publisher?.name ?? post.author.displayName ?? post.author.handle
  const headlineText = article.title
  const textLike = kind === 'text' || (kind === 'quote' && !hasMedia)
  const headline = (textLike ? TEXT_POST_HEADLINE : HEADLINE)[size]
  const standfirstLines = STANDFIRST_LINES[size]
  const isLead = size === 'lead'
  const isCompact = size === 'compact'
  const postText = article.item.moderation.ui('contentList')
  const quoted = article.quote?.record
  const quoteAuthor =
    quoted && 'author' in quoted
      ? (quoted.author as {handle: string}).handle
      : undefined
  const quoteText =
    quoted && 'value' in quoted && typeof quoted.value === 'object'
      ? (quoted.value as {text?: string}).text
      : undefined

  const label = cardAccessibleName({
    publisher: publisherName,
    topic,
    format,
    headline: headlineText,
    time: time.label,
    comments: l`${plural(post.replyCount ?? 0, {
      one: '# comment',
      other: '# comments',
    })}`,
    reposts: l`${plural((post.repostCount ?? 0) + (post.quoteCount ?? 0), {
      one: '# repost',
      other: '# reposts',
    })}`,
    likes: l`${plural(post.likeCount ?? 0, {one: '# like', other: '# likes'})}`,
  })

  const media = hasMedia && (
    <Media
      article={article}
      kind={kind}
      size={size}
      moderation={postText.blur ? undefined : moderation}
    />
  )

  const story = (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[a.gap_sm]}>
      <Text
        emoji
        testID="newsCardHeadline"
        style={[
          t.atoms.text,
          headline,
          web({
            overflowWrap: 'anywhere',
            textWrap: 'balance',
            textDecorationLine: hovered ? 'underline' : 'none',
          }),
        ]}>
        {headlineText}
      </Text>
      {standfirstLines > 0 && !!article.description && (
        <Text
          emoji
          testID="newsCardStandfirst"
          numberOfLines={standfirstLines}
          style={[
            t.atoms.text_contrast_medium,
            {
              fontSize: STANDFIRST_SIZE[size],
              lineHeight: Math.round(STANDFIRST_SIZE[size] * 1.45),
            },
          ]}>
          {article.description}
        </Text>
      )}
      {kind === 'quote' && !!quoteAuthor && !isCompact && (
        <Text
          emoji
          testID="newsCardQuoteLine"
          numberOfLines={2}
          style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {quoteText
            ? l`↪ Quoting @${quoteAuthor}: “${quoteText}”`
            : l`↪ Quoting @${quoteAuthor}`}
        </Text>
      )}
    </View>
  )

  const body = (
    <View
      pointerEvents="box-none"
      style={[a.gap_sm, {minWidth: 0}, (isLead || isCompact) && a.flex_1]}>
      <Kicker
        author={post.author}
        topic={topic}
        format={kind === 'youtube' ? format : undefined}
        moderationOpts={opts}
      />
      {postText.blur ? (
        <ContentHider modui={postText}>{story}</ContentHider>
      ) : (
        story
      )}
      {isLead && <View style={a.flex_1} pointerEvents="none" />}
      <CardActions post={post} createdAt={article.item.record.createdAt} />
    </View>
  )

  return (
    <View
      testID="newsCard"
      style={[
        a.relative,
        isLead || isCompact
          ? [a.flex_row, a.align_start, isLead ? {gap: 28} : {gap: 14}]
          : a.gap_md,
        pressed && {opacity: 0.85},
        focused &&
          web({
            outlineStyle: 'solid',
            outlineWidth: 2,
            outlineColor: t.palette.primary_500,
            outlineOffset: 4,
          }),
      ]}>
      <Link
        testID="newsCardLink"
        to={makeProfileLink(post.author, 'post', new AtUri(post.uri).rkey)}
        label={label}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[a.absolute, a.inset_0, web({outlineStyle: 'none'})]}>
        <View />
      </Link>
      {isLead ? (
        <>
          {body}
          <View pointerEvents="box-none" style={[{flex: 2, minWidth: 0}]}>
            {media}
          </View>
        </>
      ) : isCompact ? (
        <>
          {body}
          {media}
        </>
      ) : (
        <>
          {media}
          {body}
        </>
      )}
    </View>
  )
}
