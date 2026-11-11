import {ScrollView, View} from 'react-native'
import {Image} from 'expo-image'
import {LinearGradient} from 'expo-linear-gradient'
import {Trans, useLingui} from '@lingui/react/macro'

import {POST_TOMBSTONE, usePostShadow} from '#/state/cache/post-shadow'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {usePostFeedQuery} from '#/state/queries/post-feed'
import {atoms as a, useBreakpoints, web} from '#/alf'
import {Link} from '#/components/Link'
import {ContentHider} from '#/components/moderation/ContentHider'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'
import {type PostArticle} from '#/features/articles/articles'
import {articleModeration} from '#/features/articles/moderation'
import {articlesFromPublisherFeed} from '#/features/publishers/articles'
import {publisherFeedDescriptor} from '#/features/publishers/feedDescriptor'
import {findPublisherByDid} from '#/features/publishers/publishers'

/** Share the Shorts query, but mount only thumbnails in the article feed. */
export function HomeShortsRow({
  publisherDids,
}: {publisherDids?: readonly string[]} = {}) {
  const {t: l} = useLingui()
  const opts = useModerationOpts()
  const feed = usePostFeedQuery(publisherFeedDescriptor('videos'))
  const videos = articlesFromPublisherFeed(
    feed.data?.pages.flatMap(page => page.slices) ?? [],
  )
    .filter(
      article =>
        (!publisherDids ||
          publisherDids.includes(article.item.post.author.did)) &&
        article.media?.type === 'video' &&
        article.media.view.presentation !== 'gif' &&
        !articleModeration(article, opts).filter,
    )
    .slice(0, 10)
  if (!opts || !videos.length) return null
  return (
    <View testID="homeShortsRow" style={[a.gap_md, a.py_xl]}>
      <View style={[a.flex_row, a.align_center, a.justify_between]}>
        <Text
          testID="homeShortsHeading"
          accessibilityRole="header"
          style={[a.font_semi_bold, {fontSize: 22, lineHeight: 26}]}>
          <Trans>Shorts</Trans>
        </Text>
        <Link to={{screen: 'Shorts'}} label={l`See all shorts`}>
          <Text style={[a.text_sm, a.font_medium]}>
            <Trans>See all</Trans>
          </Text>
        </Link>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[a.gap_md]}
        style={web({
          scrollSnapType: 'x proximity',
          overscrollBehaviorX: 'contain',
        })}>
        {videos.map(article => (
          <ShortCard key={article.item.uri} article={article} />
        ))}
      </ScrollView>
    </View>
  )
}

function ShortCard({article}: {article: PostArticle}) {
  const opts = useModerationOpts()
  const post = usePostShadow(article.item.post)
  const {gtMobile} = useBreakpoints()
  if (post === POST_TOMBSTONE || !opts || article.media?.type !== 'video')
    return null
  const moderation = articleModeration(article, opts)
  if (moderation.filter) return null
  const publisher = findPublisherByDid(post.author.did)
  return (
    <View
      style={[
        a.overflow_hidden,
        a.rounded_xs,
        {
          width: gtMobile ? 176 : 148,
          aspectRatio: 9 / 16,
          backgroundColor: '#181818',
        },
        web({scrollSnapAlign: 'start'}),
      ]}>
      <ContentHider
        modui={moderation}
        style={[a.flex_1]}
        childContainerStyle={[a.flex_1]}>
        <Link
          testID="homeShortCard"
          to={{screen: 'Shorts', params: {initialPostUri: post.uri}}}
          label={
            article.item.record.text || publisher?.name || post.author.handle
          }
          style={[a.flex_1, a.w_full]}>
          {!!article.media.view.thumbnail && (
            <Image
              source={{uri: article.media.view.thumbnail}}
              contentFit="cover"
              accessibilityIgnoresInvertColors
              style={[a.absolute, a.inset_0]}
            />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,.85)']}
            style={[a.absolute, a.inset_0, {top: '35%'}]}
          />
          <View
            style={[
              a.absolute,
              a.gap_sm,
              a.p_md,
              {left: 0, right: 0, bottom: 0},
            ]}>
            <Text
              emoji
              testID="homeShortCaption"
              numberOfLines={3}
              style={[
                a.font_semi_bold,
                {fontSize: 15, lineHeight: 19, color: '#fff'},
              ]}>
              {article.item.record.text}
            </Text>
            <View style={[a.flex_row, a.align_center, a.gap_xs]}>
              <ProfileCard.Avatar
                profile={post.author}
                moderationOpts={opts}
                size={16}
                disabledPreview
                disableLink
              />
              <Text
                emoji
                numberOfLines={1}
                style={[a.text_xs, a.font_semi_bold, {color: '#EDEBE5'}]}>
                {publisher?.name || post.author.handle}
              </Text>
            </View>
          </View>
        </Link>
      </ContentHider>
    </View>
  )
}
