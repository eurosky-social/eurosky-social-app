import {createElement, useEffect, useRef, useState} from 'react'
import {useIsFocused} from '@react-navigation/native'

/** Observe the actual end of the spread, whether scrolling belongs to the page or an inner ScrollView. */
export function useInfiniteScroll(feed: {
  hasNextPage?: boolean
  isFetchingNextPage: boolean
  isError: boolean
  fetchNextPage: () => Promise<unknown>
}) {
  const focused = useIsFocused()
  const element = useRef<HTMLDivElement>(null)
  const requested = useRef(false)
  const [nearEnd, setNearEnd] = useState(false)
  useEffect(() => {
    if (!focused || !element.current) return
    const observer = new IntersectionObserver(
      ([entry]) => setNearEnd(!!entry?.isIntersecting),
      {rootMargin: '600px 0px'},
    )
    observer.observe(element.current)
    return () => observer.disconnect()
  }, [focused])
  useEffect(() => {
    if (
      !focused ||
      !nearEnd ||
      !feed.hasNextPage ||
      feed.isFetchingNextPage ||
      feed.isError ||
      requested.current ||
      !element.current ||
      element.current.getBoundingClientRect().top > window.innerHeight + 600
    )
      return
    requested.current = true
    void feed
      .fetchNextPage()
      .catch(() => {})
      .finally(() => {
        requested.current = false
      })
  }, [feed, focused, nearEnd])
  return {
    sentinel: createElement('div', {
      ref: element,
      'aria-hidden': true,
      style: {height: 1, pointerEvents: 'none', overflowAnchor: 'none'},
    }),
  }
}
