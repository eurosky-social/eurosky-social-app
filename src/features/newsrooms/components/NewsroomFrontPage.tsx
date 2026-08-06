import {View} from 'react-native'
import {Image} from 'expo-image'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Divider} from '#/components/Divider'
import {EditBig_Stroke2_Corner2_Rounded as ComposeIcon} from '#/components/icons/EditBig'
import {InlineLinkText, Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {articleSearchPath} from '../discussion'
import {getPublisherRssUrls, type NewsroomPublisher} from '../publishers'
import {
  useArticleDiscussionQuery,
  useArticleDiscussionsQuery,
  useOgImageQuery,
  useRssArticlesQuery,
} from '../queries'
import {type RssItem} from '../rss/types'
import {ArticleDiscussion} from './ArticleDiscussion'

export function NewsroomFrontPage({publisher}: {publisher: NewsroomPublisher}) {
  const urls = getPublisherRssUrls(publisher)
  const {data: articles, isLoading} = useRssArticlesQuery({urls})
  const discussions = useArticleDiscussionsQuery({
    urls: articles?.map(item => item.link) ?? [],
    publisherDid: publisher.did,
  })

  if (urls.length === 0) return null

  /*
   * Featuring depends on every article's interaction total, so the loader
   * holds until the discussion lookups settle too - otherwise the hero would
   * visibly swap once the counts arrive.
   */
  if (isLoading || discussions.some(q => q.isLoading)) {
    return (
      <View style={[a.px_lg, a.py_xl, a.align_center]}>
        <Loader size="md" />
      </View>
    )
  }

  // No articles (feed empty, or unreachable without the dev CORS proxy on web):
  // render nothing rather than an empty shell.
  if (!articles?.length) return null

  /*
   * The featured story is whichever article drew the most Atmosphere
   * interactions, discounted by age so last week's viral piece eventually
   * cedes the hero slot to fresher news. Ties (including all-zero, e.g. when
   * search is down) fall back to the feed's newest-first order, which the
   * rest keep.
   */
  const now = Date.now()
  const scores = new Map(
    articles.map((item, i) => [
      item,
      heroScore(item, discussions[i]?.data?.interactions ?? 0, now),
    ]),
  )
  const hero = articles.reduce((top, item) =>
    (scores.get(item) ?? 0) > (scores.get(top) ?? 0) ? item : top,
  )
  const rest = articles.filter(item => item !== hero)

  return (
    <View style={[a.px_lg, a.pt_sm, a.pb_lg, a.gap_md]}>
      <HeroArticle item={hero} publisher={publisher} />
      {/* The anchor: real in-network discussion of the lead story. */}
      <ArticleDiscussion url={hero.link} publisherDid={publisher.did} />
      {rest.length > 0 && (
        <>
          <Divider />
          <View style={[a.gap_md]}>
            {rest.map(item => (
              <SecondaryArticle
                key={item.id}
                item={item}
                publisher={publisher}
              />
            ))}
          </View>
        </>
      )}
    </View>
  )
}

function HeroArticle({
  item,
  publisher,
}: {
  item: RssItem
  publisher: NewsroomPublisher
}) {
  const t = useTheme()
  // Upgrade the prominent hero image to the article's full-res og:image; the
  // feed thumbnail shows immediately as a fallback while it loads.
  const {data: ogImage} = useOgImageQuery({url: item.link})
  const heroImage = ogImage || item.imageUrl

  return (
    <View style={[a.gap_sm]}>
      <Link to={item.link} label={item.title} style={[a.flex_col, a.gap_sm]}>
        {!!heroImage && (
          <Image
            accessibilityIgnoresInvertColors
            source={{uri: heroImage}}
            style={[a.w_full, a.rounded_md, {aspectRatio: 16 / 9}]}
            contentFit="cover"
            transition={200}
          />
        )}
        <Text style={[a.text_2xl, a.font_bold, a.leading_tight, t.atoms.text]}>
          {item.title}
        </Text>
        {!!item.description && (
          <Text
            numberOfLines={3}
            style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
            {item.description}
          </Text>
        )}
        <ArticleMeta item={item} />
      </Link>
      <ArticleShareButton
        item={item}
        publisherDid={publisher.did}
        accent={publisher.accent}
        prominent
      />
    </View>
  )
}

function SecondaryArticle({
  item,
  publisher,
}: {
  item: RssItem
  publisher: NewsroomPublisher
}) {
  const t = useTheme()
  const {data: discussion} = useArticleDiscussionQuery({
    url: item.link,
    publisherDid: publisher.did,
  })
  // The feed thumbnail is plenty at 96px; only the hero pays for an og:image
  // scrape (a full page fetch per article).
  const image = item.imageUrl

  /*
   * The meta line's post count is its own link, so it sits beside the article
   * link rather than inside it - a link within a link is invalid on web and
   * unreliable on native.
   */
  return (
    <View style={[a.flex_row, a.gap_md, a.align_start]}>
      <View style={[a.flex_1, a.flex_row, a.gap_md]}>
        {!!image && (
          <Link to={item.link} label={item.title}>
            <Image
              accessibilityIgnoresInvertColors
              source={{uri: image}}
              style={[a.rounded_sm, {width: 96, height: 72}]}
              contentFit="cover"
              transition={200}
            />
          </Link>
        )}
        <View style={[a.flex_1, a.gap_2xs]}>
          <Link
            to={item.link}
            label={item.title}
            style={[a.flex_col, a.gap_2xs, a.w_full]}>
            <Text
              numberOfLines={2}
              style={[a.text_md, a.font_bold, a.leading_snug, t.atoms.text]}>
              {item.title}
            </Text>
            {!!item.description && (
              <Text
                numberOfLines={2}
                style={[
                  a.text_sm,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                ]}>
                {item.description}
              </Text>
            )}
          </Link>
          <ArticleMeta
            item={item}
            discussionCount={discussion?.total}
            discussionPath={articleSearchPath(item.link)}
          />
        </View>
      </View>
      <ArticleShareButton item={item} publisherDid={publisher.did} compact />
    </View>
  )
}

function ArticleShareButton({
  item,
  publisherDid,
  accent,
  compact = false,
  prominent = false,
}: {
  item: RssItem
  publisherDid?: string
  /** Publisher brand color; tints the prominent CTA to match the masthead's
   * follow button. */
  accent?: string
  compact?: boolean
  prominent?: boolean
}) {
  const {t: l} = useLingui()
  const {openComposer} = useOpenComposer()
  // Cache-shared with the article's discussion block: one search per article.
  const {data: discussion} = useArticleDiscussionQuery({
    url: item.link,
    publisherDid,
  })

  /*
   * When the publisher posted the article and it can still be embedded, quote
   * that post so every share grows one canonical conversation. Fall back to
   * the article card when embedding is disabled or the viewer cannot interact
   * with the publisher.
   */
  function onShare() {
    const anchor = discussion?.anchor
    const anchorIsBlocked = Boolean(
      anchor?.author.viewer?.blocking ||
      anchor?.author.viewer?.blockedBy ||
      anchor?.author.viewer?.blockingByList,
    )
    if (anchor && !anchor.viewer?.embeddingDisabled && !anchorIsBlocked) {
      openComposer({quote: anchor, logContext: 'Other'})
    } else {
      openComposer({externalUri: item.link, logContext: 'Other'})
    }
  }

  // The hero's call to action: a full-width primary button to post the lead
  // story into the conversation.
  if (prominent) {
    return (
      <Button
        label={l`Share “${item.title}” in a post`}
        size="large"
        color="primary"
        onPress={onShare}
        style={[a.w_full, !!accent && {backgroundColor: accent}]}>
        <ButtonIcon icon={ComposeIcon} />
        <ButtonText>
          <Trans>Share this story</Trans>
        </ButtonText>
      </Button>
    )
  }

  return (
    <Button
      label={l`Share “${item.title}” in a post`}
      size="small"
      variant="ghost"
      color="secondary"
      shape={compact ? 'round' : 'default'}
      onPress={onShare}>
      <ButtonIcon icon={ComposeIcon} />
      {!compact && (
        <ButtonText>
          <Trans>Share</Trans>
        </ButtonText>
      )}
    </Button>
  )
}

function ArticleMeta({
  item,
  discussionCount,
  discussionPath,
}: {
  item: RssItem
  discussionCount?: number
  /** Makes the post count a link into the article's posts. */
  discussionPath?: string
}) {
  const t = useTheme()
  const {i18n, t: l} = useLingui()
  const hostname = safeHostname(item.link)
  const postCount = plural(discussionCount ?? 0, {
    one: '# post',
    other: '# posts',
  })

  return (
    <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
      {hostname}
      {!!item.publishedAt && (
        <>
          {' · '}
          {i18n.date(new Date(item.publishedAt), {dateStyle: 'medium'})}
        </>
      )}
      {!!discussionCount && (
        <>
          {' · '}
          {discussionPath ? (
            <InlineLinkText
              to={discussionPath}
              label={l`See this story in the Atmosphere`}
              style={[a.text_xs]}>
              {postCount}
            </InlineLinkText>
          ) : (
            postCount
          )}
        </>
      )}
    </Text>
  )
}

/** How long an interaction keeps half its weight in the hero choice. */
const HERO_HALF_LIFE_MS = 24 * 60 * 60 * 1000

/**
 * An article's claim on the hero slot: its Atmosphere interactions decayed
 * exponentially by age. Undated articles count as two half-lives old, so a
 * dated story with comparable engagement beats them.
 */
function heroScore(item: RssItem, interactions: number, now: number): number {
  const published = item.publishedAt
    ? new Date(item.publishedAt).getTime()
    : NaN
  const ageMs = Number.isNaN(published)
    ? HERO_HALF_LIFE_MS * 2
    : Math.max(0, now - published)
  return interactions * 0.5 ** (ageMs / HERO_HALF_LIFE_MS)
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
