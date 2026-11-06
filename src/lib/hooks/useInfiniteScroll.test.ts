import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native'
import {act, renderHook} from '@testing-library/react-native'

import {useInfiniteScroll} from './useInfiniteScroll'

let mockFocused = true
jest.mock('@react-navigation/native', () => ({useIsFocused: () => mockFocused}))
const fetchNextPage = jest.fn(() => Promise.resolve())
beforeEach(() => {
  mockFocused = true
  fetchNextPage.mockClear()
})
function scroll(y: number, height = 4000) {
  return {
    nativeEvent: {
      contentOffset: {y},
      contentSize: {height},
      layoutMeasurement: {height: 800},
    },
  } as NativeSyntheticEvent<NativeScrollEvent>
}
const feed = {
  hasNextPage: true,
  isFetchingNextPage: false,
  isError: false,
  fetchNextPage,
}
it('prefetches near the end and deduplicates scroll events while a request is pending', async () => {
  const {result} = renderHook(() => useInfiniteScroll(feed))
  act(() => result.current.onScroll(scroll(0)))
  expect(fetchNextPage).not.toHaveBeenCalled()
  act(() => {
    result.current.onScroll(scroll(2700))
    result.current.onScroll(scroll(2800))
  })
  expect(fetchNextPage).toHaveBeenCalledTimes(1)
  await act(async () => {
    await Promise.resolve()
  })
})
it('fills a viewport without requiring a scroll or a button press', async () => {
  const {result} = renderHook(() => useInfiniteScroll(feed))
  act(() => {
    result.current.onLayout({
      nativeEvent: {layout: {height: 800}},
    } as LayoutChangeEvent)
    result.current.onContentSizeChange(1000, 300)
  })
  expect(fetchNextPage).toHaveBeenCalledTimes(1)
  await act(async () => {
    await Promise.resolve()
  })
})
it.each(['unfocused', 'end', 'error', 'fetching'])(
  'does not request another page when %s',
  state => {
    mockFocused = state !== 'unfocused'
    const {result} = renderHook(() =>
      useInfiniteScroll({
        ...feed,
        hasNextPage: state !== 'end',
        isError: state === 'error',
        isFetchingNextPage: state === 'fetching',
      }),
    )
    act(() => result.current.onScroll(scroll(3900)))
    expect(fetchNextPage).not.toHaveBeenCalled()
  },
)
