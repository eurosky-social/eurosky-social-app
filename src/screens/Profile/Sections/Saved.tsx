import {useEffect, useImperativeHandle, useState} from 'react'
import {useWindowDimensions} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {useQueryClient} from '@tanstack/react-query'

import {cleanError} from '#/lib/strings/errors'
import {
  createBookmarksQueryKey,
  useBookmarksQuery,
} from '#/state/queries/bookmarks/useBookmarksQuery'
import {Post} from '#/view/com/post/Post'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List, type ListRef} from '#/view/com/util/List'
import {findListNativeTag} from '#/view/com/util/listNativeTag'
import {PostFeedLoadingPlaceholder} from '#/view/com/util/LoadingPlaceholder'
import {atoms as a, ios, useTheme} from '#/alf'
import {BookmarkDeleteLarge} from '#/components/icons/Bookmark'
import {ListFooter} from '#/components/Lists'
import {IS_IOS, IS_NATIVE} from '#/env'
import {app} from '#/lexicons'
import * as bsky from '#/types/bsky'
import {type SectionRef} from './types'

/**
 * The signed-in user's saved posts, as a tab on their own profile. Deleted
 * posts are skipped here; the standalone Saved screen still lists them so they
 * can be removed.
 */
export function ProfileSavedSection({
  ref,
  headerOffset,
  isFocused,
  scrollElRef,
  setScrollViewTag,
}: {
  ref?: React.Ref<SectionRef>
  headerOffset: number
  isFocused: boolean
  scrollElRef: ListRef
  setScrollViewTag: (tag: number | null) => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const {height} = useWindowDimensions()
  const queryClient = useQueryClient()
  const [isPTRing, setIsPTRing] = useState(false)
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error,
    refetch,
  } = useBookmarksQuery()

  const posts: app.bsky.feed.defs.PostView[] =
    data?.pages
      .flatMap(page => page.bookmarks)
      .flatMap(bookmark =>
        bsky.isType(app.bsky.feed.defs.postView, bookmark.item)
          ? [bookmark.item]
          : [],
      ) ?? []

  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      scrollElRef.current?.scrollToOffset({
        animated: IS_NATIVE,
        offset: -headerOffset,
      })
      void queryClient.invalidateQueries({queryKey: createBookmarksQueryKey()})
    },
  }))

  useEffect(() => {
    if (IS_IOS && isFocused && scrollElRef.current) {
      setScrollViewTag(findListNativeTag(scrollElRef.current))
    }
  }, [isFocused, scrollElRef, setScrollViewTag])

  const onRefresh = async () => {
    setIsPTRing(true)
    try {
      await refetch()
    } finally {
      setIsPTRing(false)
    }
  }

  const onEndReached = async () => {
    if (isFetchingNextPage || !hasNextPage || error) return
    try {
      await fetchNextPage()
    } catch {}
  }

  return (
    <List
      ref={scrollElRef}
      data={posts}
      keyExtractor={(post: app.bsky.feed.defs.PostView) => post.uri}
      renderItem={({
        item,
        index,
      }: {
        item: app.bsky.feed.defs.PostView
        index: number
      }) => <Post post={item} hideTopBorder={index === 0} />}
      ListEmptyComponent={
        isLoading ? (
          <PostFeedLoadingPlaceholder />
        ) : error ? undefined : (
          <EmptyState
            icon={BookmarkDeleteLarge}
            message={l`Nothing saved yet`}
            textStyle={[t.atoms.text_contrast_medium, a.font_medium]}
            style={[a.pt_3xl]}
          />
        )
      }
      ListFooterComponent={
        <ListFooter
          isFetchingNextPage={isFetchingNextPage}
          error={cleanError(error)}
          onRetry={fetchNextPage}
          height={180 + headerOffset}
        />
      }
      refreshing={isPTRing}
      onRefresh={() => void onRefresh()}
      onEndReached={() => void onEndReached()}
      onEndReachedThreshold={4}
      headerOffset={headerOffset}
      progressViewOffset={ios(0)}
      desktopFixedHeight
      contentContainerStyle={{minHeight: height + headerOffset}}
    />
  )
}
