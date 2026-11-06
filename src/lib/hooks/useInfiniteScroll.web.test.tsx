import {act, render} from '@testing-library/react-native'

import {useInfiniteScroll} from './useInfiniteScroll.web'

let mockFocused = true
jest.mock('@react-navigation/native', () => ({useIsFocused: () => mockFocused}))
let signal: (near: boolean) => void
const disconnect = jest.fn()
const node = {getBoundingClientRect: jest.fn(() => ({top: 5000}))}
const originalObserver = global.IntersectionObserver
beforeEach(() => {
  mockFocused = true
  node.getBoundingClientRect.mockReturnValue({top: 5000})
  Object.defineProperty(window, 'innerHeight', {
    value: 1000,
    configurable: true,
  })
  global.IntersectionObserver = jest.fn(
    (callback: IntersectionObserverCallback) => {
      signal = near =>
        callback(
          [{isIntersecting: near}] as IntersectionObserverEntry[],
          {} as IntersectionObserver,
        )
      return {observe: jest.fn(), disconnect}
    },
  ) as unknown as typeof IntersectionObserver
})
afterEach(() => {
  global.IntersectionObserver = originalObserver
  jest.clearAllMocks()
})
function Harness({feed}: {feed: Parameters<typeof useInfiniteScroll>[0]}) {
  return useInfiniteScroll(feed).sentinel
}
function setup(overrides = {}) {
  const feed = {
    hasNextPage: true,
    isFetchingNextPage: false,
    isError: false,
    fetchNextPage: jest.fn(() => Promise.resolve()),
    ...overrides,
  }
  const view = render(<Harness feed={feed} />, {createNodeMock: () => node})
  return {feed, ...view}
}
it('does not mistake a full-height page for an empty viewport', () => {
  const {feed, unmount} = setup()
  act(() => signal(true)) // An old intersection from the loading skeleton.
  expect(feed.fetchNextPage).not.toHaveBeenCalled()
  unmount()
  expect(disconnect).toHaveBeenCalled()
})
it('fetches one batch near the bottom, then stops when appended stories push the bottom away', async () => {
  node.getBoundingClientRect.mockReturnValue({top: 1500})
  let finish!: () => void
  const fetchNextPage = jest.fn(
    () =>
      new Promise<void>(resolve => {
        finish = resolve
      }),
  )
  const {feed, rerender} = setup({fetchNextPage})
  act(() => signal(true))
  expect(fetchNextPage).toHaveBeenCalledTimes(1)
  act(() => {
    signal(false)
    signal(true)
  })
  expect(fetchNextPage).toHaveBeenCalledTimes(1)
  node.getBoundingClientRect.mockReturnValue({top: 5000})
  await act(async () => {
    finish()
    await Promise.resolve()
  })
  rerender(<Harness feed={{...feed}} />)
  expect(fetchNextPage).toHaveBeenCalledTimes(1)
})
it.each([{hasNextPage: false}, {isFetchingNextPage: true}, {isError: true}])(
  'does not fetch while unavailable: %o',
  overrides => {
    node.getBoundingClientRect.mockReturnValue({top: 1400})
    const {feed} = setup(overrides)
    act(() => signal(true))
    expect(feed.fetchNextPage).not.toHaveBeenCalled()
  },
)
it('does not observe background scenes', () => {
  mockFocused = false
  const {feed} = setup()
  expect(global.IntersectionObserver).not.toHaveBeenCalled()
  expect(feed.fetchNextPage).not.toHaveBeenCalled()
})
