import {useEffect} from 'react'
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
import {articleModeration} from '#/features/articles/moderation'
import {FrontPageSkeleton} from '#/features/newsCards/FrontPage'
import {SectionedFrontPage} from '#/features/newsCards/FrontPage/SectionedFrontPage'
import {SECTION_WINDOW} from '#/features/newsCards/sections'
import {articlesFromPublisherFeed} from '#/features/publishers/articles'
import {publisherFeedDescriptor} from '#/features/publishers/feedDescriptor'
import {HomeShortsRow} from './ShortsRow'

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
  const feed = usePostFeedQuery(
    publisherFeedDescriptor('articles', publisherDids),
  )
  const {sentinel, ...scroll} = useInfiniteScroll(feed)
  const articles = articlesFromPublisherFeed(
    feed.data?.pages.flatMap(page => page.slices) ?? [],
  ).filter(article => !articleModeration(article, opts).filter)
  /*
   * Discover builds its sections from the first 60 stories, so ask for the
   * second page straight away instead of waiting for the reader to scroll.
   */
  const wantsWindow =
    !publisherDids &&
    !feed.isPending &&
    articles.length < SECTION_WINDOW &&
    !!feed.hasNextPage &&
    !feed.isFetchingNextPage
  useEffect(() => {
    if (wantsWindow) void feed.fetchNextPage()
  }, [wantsWindow, feed])
  return (
    <Layout.Content
      webPageScroll
      {...scroll}
      contentContainerStyle={[a.pb_4xl]}>
      {header}
      <View style={[a.px_lg]}>
        {feed.isPending ? (
          <FrontPageSkeleton />
        ) : (
          <SectionedFrontPage
            articles={articles}
            mode={publisherDids ? 'following' : 'discover'}
            shorts={publisherDids ? undefined : <HomeShortsRow />}
            complete={feed.hasNextPage === false}
          />
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
