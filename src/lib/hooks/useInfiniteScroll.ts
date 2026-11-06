import {useCallback, useEffect, useRef} from 'react'
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
} from 'react-native'
import {useIsFocused} from '@react-navigation/native'

/** Shared ScrollView pagination for the public reader. Never fetch for a cached, unfocused scene. */
export function useInfiniteScroll(feed: {
  hasNextPage?: boolean
  isFetchingNextPage: boolean
  isError: boolean
  fetchNextPage: () => Promise<unknown>
}) {
  const focused = useIsFocused()
  const {height: windowHeight} = useWindowDimensions()
  const metrics = useRef({height: 0, viewport: 0, offset: 0})
  const requested = useRef(false)
  const check = useCallback(() => {
    const {height, viewport, offset} = metrics.current
    if (
      !focused ||
      !feed.hasNextPage ||
      feed.isFetchingNextPage ||
      feed.isError ||
      requested.current ||
      viewport <= 0 ||
      height <= 0 ||
      offset + viewport < height - 600
    )
      return
    requested.current = true
    void feed
      .fetchNextPage()
      .catch(() => {})
      .finally(() => {
        requested.current = false
      })
  }, [feed, focused])
  useEffect(() => {
    check()
  }, [check])
  return {
    sentinel: null,
    scrollEventThrottle: 100,
    onLayout: (event: LayoutChangeEvent) => {
      metrics.current.viewport = Math.min(
        event.nativeEvent.layout.height,
        windowHeight,
      )
      check()
    },
    onContentSizeChange: (_width: number, height: number) => {
      metrics.current.height = height
      check()
    },
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const {contentOffset, contentSize, layoutMeasurement} = event.nativeEvent
      metrics.current = {
        height: contentSize.height,
        viewport: Math.min(layoutMeasurement.height, windowHeight),
        offset: contentOffset.y,
      }
      check()
    },
  }
}
