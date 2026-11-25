import {afterEach, beforeEach, expect, it, jest} from '@jest/globals'
import {QueryClient} from '@tanstack/react-query'
import {act, renderHook} from '@testing-library/react-native'

import {
  forgetPostedComment,
  POSTED_COMMENT_KEEP_MS,
  postedCommentsOn,
  rememberPostedComment,
  usePostedComments,
} from '../postedComments'
import {momentsQueryKey, momentSummaryQueryKey} from '../queryKeys'

const VIDEO = 'at://did:plc:alice/app.bsky.feed.post/3lvideo'
const OTHER_VIDEO = 'at://did:plc:alice/app.bsky.feed.post/3lother'
const reply = (n: number) => `at://did:plc:me/app.bsky.feed.post/${n}`

let queryClient: QueryClient

beforeEach(() => {
  jest.useFakeTimers()
  queryClient = new QueryClient()
})

afterEach(() => {
  for (const video of [VIDEO, OTHER_VIDEO]) {
    for (const c of postedCommentsOn(video)) forgetPostedComment(c.uri)
  }
  jest.useRealTimers()
})

it('keeps a posted comment with its video only', () => {
  rememberPostedComment(queryClient, {
    uri: reply(1),
    videoPostUri: VIDEO,
    seconds: 41,
  })
  expect(postedCommentsOn(VIDEO)).toEqual([{uri: reply(1), seconds: 41}])
  expect(postedCommentsOn(OTHER_VIDEO)).toEqual([])
})

it("asks for the video's moments and counts again", () => {
  const invalidate = jest.spyOn(queryClient, 'invalidateQueries')
  rememberPostedComment(queryClient, {
    uri: reply(1),
    videoPostUri: VIDEO,
    seconds: 41,
  })
  expect(invalidate).toHaveBeenCalledWith({queryKey: momentsQueryKey(VIDEO)})
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: momentSummaryQueryKey(VIDEO),
  })
})

it('remembers the same comment once', () => {
  for (const seconds of [41, 42]) {
    rememberPostedComment(queryClient, {
      uri: reply(1),
      videoPostUri: VIDEO,
      seconds,
    })
  }
  expect(postedCommentsOn(VIDEO)).toEqual([{uri: reply(1), seconds: 42}])
})

it('forgets a comment when it is deleted, and all of them after a while', () => {
  for (const n of [1, 2]) {
    rememberPostedComment(queryClient, {
      uri: reply(n),
      videoPostUri: VIDEO,
      seconds: n,
    })
  }
  forgetPostedComment(reply(2))
  expect(postedCommentsOn(VIDEO)).toEqual([{uri: reply(1), seconds: 1}])
  jest.advanceTimersByTime(POSTED_COMMENT_KEEP_MS)
  expect(postedCommentsOn(VIDEO)).toEqual([])
})

it('updates components that show a video', () => {
  const {result} = renderHook(() => usePostedComments(VIDEO))
  expect(result.current).toEqual([])
  act(() =>
    rememberPostedComment(queryClient, {
      uri: reply(1),
      videoPostUri: VIDEO,
      seconds: 41,
    }),
  )
  expect(result.current).toEqual([{uri: reply(1), seconds: 41}])
  act(() => forgetPostedComment(reply(1)))
  expect(result.current).toEqual([])
})
