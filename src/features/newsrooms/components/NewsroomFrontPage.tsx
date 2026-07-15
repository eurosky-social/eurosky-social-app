import {View} from 'react-native'
import {Image} from 'expo-image'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Divider} from '#/components/Divider'
import {EditBig_Stroke2_Corner2_Rounded as ComposeIcon} from '#/components/icons/EditBig'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {getPublisherRssUrls, type NewsroomPublisher} from '../publishers'
import {
  useArticleDiscussionQuery,
  useOgImageQuery,
  useRssArticlesQuery,
} from '../queries'
import {type RssItem} from '../rss/types'
import {ArticleDiscussion} from './ArticleDiscussion'

export function NewsroomFrontPage({publisher}: {publisher: NewsroomPublisher}) {
  const urls = getPublisherRssUrls(publisher)
  const {data: articles, isLoading} = useRssArticlesQuery({urls})

  if (urls.length === 0) return null

  if (isLoading) {
    return (
      <View style={[a.px_lg, a.py_xl, a.align_center]}>
        <Loader size="md" />
      </View>
    )
  }

  // No articles (feed empty, or unreachable without the dev CORS proxy on web):
  // render nothing rather than an empty shell.
  if (!articles?.length) return null

  const [hero, ...rest] = articles

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

  return (
    <View style={[a.flex_row, a.gap_md, a.align_start]}>
      <Link
        to={item.link}
        label={item.title}
        style={[a.flex_1, a.flex_row, a.gap_md]}>
        {!!image && (
          <Image
            accessibilityIgnoresInvertColors
            source={{uri: image}}
            style={[a.rounded_sm, {width: 96, height: 72}]}
            contentFit="cover"
            transition={200}
          />
        )}
        <View style={[a.flex_1, a.gap_2xs]}>
          <Text
            numberOfLines={2}
            style={[a.text_md, a.font_bold, a.leading_snug, t.atoms.text]}>
            {item.title}
          </Text>
          {!!item.description && (
            <Text
              numberOfLines={2}
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              {item.description}
            </Text>
          )}
          <ArticleMeta item={item} discussionCount={discussion?.total} />
        </View>
      </Link>
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

  // When the publisher posted the article itself, sharing quotes that post so
  // every share grows the article's one canonical conversation. Otherwise seed
  // `externalUri`, which attaches the article as a link-card embed while
  // leaving the text input blank to start typing.
  function onShare() {
    if (discussion?.anchor) {
      openComposer({quote: discussion.anchor, logContext: 'Other'})
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
}: {
  item: RssItem
  discussionCount?: number
}) {
  const t = useTheme()
  const {i18n} = useLingui()
  const hostname = safeHostname(item.link)

  return (
    <Text style={[a.text_xs, t.atoms.text_contrast_low]}>
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
          {plural(discussionCount, {one: '# post', other: '# posts'})}
        </>
      )}
    </Text>
  )
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}
