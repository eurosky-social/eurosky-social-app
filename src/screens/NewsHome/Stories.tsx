import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useInfiniteScroll} from '#/lib/hooks/useInfiniteScroll'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {usePostFeedQuery} from '#/state/queries/post-feed'
import {atoms as a} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {ArticleList} from '#/features/articles/ArticleList'
import {type PostArticle} from '#/features/articles/articles'
import {articleModeration} from '#/features/articles/moderation'
import {usePageGeometry} from '#/features/product/layout/usePageGeometry'
import {articlesFromPublisherFeed} from '#/features/publishers/articles'
import {PublisherByline} from '#/features/publishers/Byline'
import {publisherFeedDescriptor} from '#/features/publishers/feedDescriptor'
import {HomeShortsRow} from './ShortsRow'

const SHORTS_AFTER_ARTICLES = 4

/** Same public reader surface with or without a session; existing sign-in controls stay in the shell. */
export function NewsStories({
  publisherDids,
  header,
}: {
  publisherDids?: readonly string[]
  header?: React.ReactNode
}) {
  const {t: l} = useLingui()
  const opts = useModerationOpts()
  const {wide} = usePageGeometry()
  const feed = usePostFeedQuery(
    publisherFeedDescriptor('articles', publisherDids),
  )
  const {sentinel, ...scroll} = useInfiniteScroll(feed)
  const articles = articlesFromPublisherFeed(
    feed.data?.pages.flatMap(page => page.slices) ?? [],
  ).filter(article => !articleModeration(article, opts).filter)
  const renderByline = (article: PostArticle) => (
    <PublisherByline profile={article.item.post.author} />
  )
  return (
    <Layout.Content
      webPageScroll
      {...scroll}
      contentContainerStyle={[a.pb_4xl]}>
      {header}
      <View style={[a.px_lg]}>
        {feed.isPending ? (
          <Status>
            <Loader size="lg" />
          </Status>
        ) : (
          <>
            <ArticleList
              articles={articles.slice(0, SHORTS_AFTER_ARTICLES)}
              wide={wide}
              density="compact"
              renderByline={renderByline}
            />
            {articles.length >= SHORTS_AFTER_ARTICLES && (
              <HomeShortsRow publisherDids={publisherDids} />
            )}
            <ArticleList
              articles={articles.slice(SHORTS_AFTER_ARTICLES)}
              offset={SHORTS_AFTER_ARTICLES}
              wide={wide}
              density="compact"
              renderByline={renderByline}
            />
          </>
        )}
        {feed.isError ? (
          <Status>
            <Text>
              <Trans>Couldn’t load stories.</Trans>
            </Text>
            <Button
              label={l`Try again`}
              color="secondary"
              size="small"
              onPress={() =>
                void (feed.isFetchNextPageError
                  ? feed.fetchNextPage()
                  : feed.refetch())
              }>
              <ButtonText>
                <Trans>Try again</Trans>
              </ButtonText>
            </Button>
          </Status>
        ) : !feed.isPending && !articles.length ? (
          <Status>
            <Text>
              <Trans>No stories yet.</Trans>
            </Text>
          </Status>
        ) : null}
        {feed.isFetchingNextPage && (
          <Status>
            <Loader size="lg" />
          </Status>
        )}
      </View>
      {sentinel}
    </Layout.Content>
  )
}
function Status({children}: {children: React.ReactNode}) {
  return <View style={[a.p_lg, a.align_center, a.gap_md]}>{children}</View>
}
