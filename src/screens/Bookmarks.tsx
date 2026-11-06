import {useCallback, useMemo, useState} from 'react'
import {View} from 'react-native'
import {type $Typed} from '@atproto/lex'
import {moderatePost} from '@bsky/sdk/moderation'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'
import {
  type NavigationProp,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native'

import {useInitialNumToRender} from '#/lib/hooks/useInitialNumToRender'
import {usePostViewTracking} from '#/lib/hooks/usePostViewTracking'
import {getHomeNavigationAction} from '#/lib/routes/navigation'
import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {cleanError} from '#/lib/strings/errors'
import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {useBookmarkMutation} from '#/state/queries/bookmarks/useBookmarkMutation'
import {useBookmarksQuery} from '#/state/queries/bookmarks/useBookmarksQuery'
import {useAutoPagination} from '#/state/queries/util'
import {Post} from '#/view/com/post/Post'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {
  Bookmark_Filled_Corner0_Rounded as BookmarkFilled,
  BookmarkDelete_Stroke2_Corner0_Rounded_Large as BookmarkDeleteLarge,
} from '#/components/icons/Bookmark'
import {CircleQuestion_Stroke2_Corner2_Rounded as QuestionIcon} from '#/components/icons/CircleQuestion'
import * as Layout from '#/components/Layout'
import {ListFooter} from '#/components/Lists'
import {PostFeedSkeleton} from '#/components/PostFeedSkeleton'
import * as Skele from '#/components/Skeleton'
import * as toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useAnalytics} from '#/analytics'
import {PRODUCT} from '#/config/product'
import {IS_IOS} from '#/env'
import {Article} from '#/features/articles/Article'
import {articleFromPost} from '#/features/articles/articles'
import {PublisherByline} from '#/features/publishers/Byline'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Bookmarks'>

export function BookmarksScreen({}: Props) {
  const ax = useAnalytics()

  useFocusEffect(
    useCallback(() => {
      ax.metric('bookmarks:view', {})
    }, [ax]),
  )

  return (
    <Layout.Screen testID="bookmarksScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Saved Posts</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <BookmarksInner />
    </Layout.Screen>
  )
}

type ListItem =
  | {
      type: 'loading'
      key: 'loading'
    }
  | {
      type: 'empty'
      key: 'empty'
    }
  | {
      type: 'bookmark'
      key: string
      bookmark: Omit<app.bsky.bookmark.defs.BookmarkView, 'item'> & {
        item: $Typed<app.bsky.feed.defs.PostView>
      }
    }
  | {
      type: 'bookmarkNotFound'
      key: string
      bookmark: Omit<app.bsky.bookmark.defs.BookmarkView, 'item'> & {
        item: $Typed<app.bsky.feed.defs.NotFoundPost>
      }
    }

function BookmarksInner() {
  const {_} = useLingui()
  const initialNumToRender = useInitialNumToRender()
  const [isPTRing, setIsPTRing] = useState(false)
  const trackPostView = usePostViewTracking('Bookmarks')
  const {
    data,
    isLoading,
    isRefetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useBookmarksQuery()
  useAutoPagination(
    {
      data,
      isLoading,
      isRefetching,
      isFetchingNextPage,
      hasNextPage: PRODUCT.id === 'news' && !!hasNextPage && !error,
      fetchNextPage,
    },
    data?.pages.reduce((count, page) => count + page.bookmarks.length, 0) ?? 0,
    1,
  )

  const onRefresh = useCallback(async () => {
    setIsPTRing(true)
    try {
      await refetch()
    } finally {
      setIsPTRing(false)
    }
  }, [refetch, setIsPTRing])

  const onEndReached = useCallback(async () => {
    if (isFetchingNextPage || !hasNextPage || error) return
    try {
      await fetchNextPage()
    } catch {}
  }, [isFetchingNextPage, hasNextPage, error, fetchNextPage])

  const items = useMemo(() => {
    const i: ListItem[] = []

    if (isLoading) {
      i.push({type: 'loading', key: 'loading'})
    } else if ((PRODUCT.id !== 'news' && error) || !data) {
      // handled in Footer
    } else {
      const bookmarks = data.pages.flatMap(p => p.bookmarks)

      if (bookmarks.length > 0) {
        for (const bookmark of bookmarks) {
          if (bsky.isType(app.bsky.feed.defs.notFoundPost, bookmark.item)) {
            i.push({
              type: 'bookmarkNotFound',
              key: bookmark.item.uri,
              bookmark: {
                ...bookmark,
                item: bookmark.item,
              },
            })
          }
          if (bsky.isType(app.bsky.feed.defs.postView, bookmark.item)) {
            i.push({
              type: 'bookmark',
              key: bookmark.item.uri,
              bookmark: {
                ...bookmark,
                item: bookmark.item,
              },
            })
          }
        }
      } else if (PRODUCT.id !== 'news' || !hasNextPage) {
        i.push({type: 'empty', key: 'empty'})
      }
    }

    return i
  }, [isLoading, error, data, hasNextPage])

  const isEmpty = items.length === 1 && items[0]?.type === 'empty'

  return (
    <List
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      refreshing={isPTRing}
      onRefresh={() => void onRefresh()}
      onEndReached={
        PRODUCT.id === 'news' && items.length === 0
          ? undefined
          : () => void onEndReached()
      }
      onEndReachedThreshold={4}
      onItemSeen={(item: ListItem) => {
        if (item.type === 'bookmark') {
          trackPostView(item.bookmark.item)
        }
      }}
      ListFooterComponent={
        <>
          <ListFooter
            isFetchingNextPage={isFetchingNextPage}
            error={cleanError(error)}
            onRetry={fetchNextPage}
            style={[isEmpty && a.border_t_0]}
          />
          {PRODUCT.id === 'news' &&
            items.length === 0 &&
            hasNextPage &&
            !isFetchingNextPage &&
            !error && (
              <View style={[a.p_lg, a.align_center]}>
                <Button
                  label={_(msg`Load more`)}
                  color="secondary"
                  size="small"
                  onPress={() => void onEndReached()}>
                  <ButtonText>
                    <Trans>Load more</Trans>
                  </ButtonText>
                </Button>
              </View>
            )}
        </>
      }
      initialNumToRender={initialNumToRender}
      windowSize={9}
      maxToRenderPerBatch={IS_IOS ? 5 : 1}
      updateCellsBatchingPeriod={40}
      sideBorders={false}
    />
  )
}

function BookmarkNotFound({
  hideTopBorder,
  post,
}: {
  hideTopBorder: boolean
  post: $Typed<app.bsky.feed.defs.NotFoundPost>
}) {
  const t = useTheme()
  const {_} = useLingui()
  const {mutateAsync: bookmark} = useBookmarkMutation()

  const remove = async () => {
    try {
      await bookmark({action: 'delete', uri: post.uri})
      toast.show(_(msg`Removed from saved posts`), {
        type: 'info',
      })
    } catch (err) {
      toast.show(cleanError(err), {
        type: 'error',
      })
    }
  }

  return (
    <View
      style={[
        a.flex_row,
        a.align_start,
        a.px_xl,
        a.py_lg,
        a.gap_sm,
        !hideTopBorder && a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <Skele.Circle size={42}>
        <QuestionIcon size="lg" fill={t.atoms.text_contrast_low.color} />
      </Skele.Circle>
      <View style={[a.flex_1, a.gap_2xs]}>
        <View style={[a.flex_row, a.gap_xs]}>
          <Skele.Text style={[a.text_md, {width: 80}]} />
          <Skele.Text style={[a.text_md, {width: 100}]} />
        </View>

        <Text
          style={[
            a.text_md,
            a.leading_snug,
            a.italic,
            t.atoms.text_contrast_medium,
          ]}>
          <Trans>This post was deleted by its author</Trans>
        </Text>
      </View>
      <Button
        label={_(msg`Remove from saved posts`)}
        size="tiny"
        color="secondary"
        onPress={() => void remove()}>
        <ButtonIcon icon={BookmarkFilled} />
        <ButtonText>
          <Trans>Remove</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}

function BookmarkItem({
  item,
  hideTopBorder,
}: {
  item: Extract<ListItem, {type: 'bookmark'}>
  hideTopBorder: boolean
}) {
  const ax = useAnalytics()
  if (PRODUCT.id === 'news')
    return (
      <NewsBookmarkArticle
        post={item.bookmark.item}
        hideTopBorder={hideTopBorder}
        onOpen={() => ax.metric('bookmarks:post-clicked', {})}
      />
    )
  return (
    <Post
      post={item.bookmark.item}
      hideTopBorder={hideTopBorder}
      onBeforePress={() => {
        ax.metric('bookmarks:post-clicked', {})
      }}
    />
  )
}

function NewsBookmarkArticle({
  post,
  hideTopBorder,
  onOpen,
}: {
  post: app.bsky.feed.defs.PostView
  hideTopBorder: boolean
  onOpen: () => void
}) {
  const opts = useModerationOpts()
  const t = useTheme()
  if (!opts || !bsky.matches(app.bsky.feed.post, post.record)) return null
  const article = articleFromPost({
    _reactKey: post.uri,
    uri: post.uri,
    post,
    record: post.record,
    moderation: moderatePost(post, opts),
  })
  return (
    <View
      style={[
        a.p_lg,
        !hideTopBorder && a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <Article
        article={article}
        linkTo="post"
        size="big"
        dense
        byline={<PublisherByline profile={post.author} />}
        onOpen={onOpen}
      />
    </View>
  )
}

function BookmarksEmpty() {
  const t = useTheme()
  const {_} = useLingui()
  const navigation = useNavigation<NavigationProp<CommonNavigatorParams>>()

  return (
    <EmptyState
      icon={BookmarkDeleteLarge}
      message={_(msg`Nothing saved yet`)}
      textStyle={[t.atoms.text_contrast_medium, a.font_medium]}
      button={{
        label: _(msg`Button to go back to the home timeline`),
        text: _(msg`Go home`),
        onPress: () =>
          navigation.dispatch(
            getHomeNavigationAction(navigation.getState(), 'navigate'),
          ),
        size: 'small',
        color: 'secondary',
      }}
      style={[a.pt_3xl]}
    />
  )
}

function renderItem({item, index}: {item: ListItem; index: number}) {
  switch (item.type) {
    case 'loading': {
      return <PostFeedSkeleton />
    }
    case 'empty': {
      return <BookmarksEmpty />
    }
    case 'bookmark': {
      return <BookmarkItem item={item} hideTopBorder={index === 0} />
    }
    case 'bookmarkNotFound': {
      return (
        <BookmarkNotFound
          post={item.bookmark.item}
          hideTopBorder={index === 0}
        />
      )
    }
    default:
      return null
  }
}

const keyExtractor = (item: ListItem) => item.key
