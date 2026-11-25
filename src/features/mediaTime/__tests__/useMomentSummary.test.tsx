import {afterEach, beforeEach, expect, it, jest} from '@jest/globals'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {renderHook, waitFor} from '@testing-library/react-native'

import {useMomentSummary} from '../momentSummaries'
import {forgetPostedComment, rememberPostedComment} from '../postedComments'

jest.mock('../config', () => ({
  MEDIA_TIME_ENABLED: true,
  MOMENTS_SERVICE_URL: 'https://moments.example',
}))

const mockCall =
  jest.fn<
    (method: unknown, params: {uri?: string; uris?: string[]}) => unknown
  >()
jest.mock('#/lib/lexClient', () => ({
  createServiceClient: () => ({call: mockCall}),
}))

const VIDEO = 'at://did:plc:alice/app.bsky.feed.post/3lvideo'
const MINE = 'at://did:plc:me/app.bsky.feed.post/mine'

// The feed counts: one moment at 0:41 to 0:50 with two comments.
const summaries = {
  summaries: [
    {
      uri: VIDEO,
      replyCount: 2,
      moments: [{startSeconds: 41, endSeconds: 50, replyCount: 2}],
    },
  ],
}
// The same moment with its comments listed, now with this app's comment.
const moments = {
  uri: VIDEO,
  replyCount: 3,
  moments: [
    {
      startSeconds: 41,
      endSeconds: 50,
      replyCount: 3,
      replies: [
        {uri: 'at://did:plc:b/app.bsky.feed.post/1', seconds: 41},
        {uri: MINE, seconds: 45},
        {uri: 'at://did:plc:c/app.bsky.feed.post/2', seconds: 50},
      ],
    },
  ],
}

let queryClient: QueryClient

function wrapper({children}: {children: React.ReactNode}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const counts = (data: {startSeconds: number; count: number}[] | undefined) =>
  data?.map(m => [m.startSeconds, m.count])

beforeEach(() => {
  mockCall.mockReset()
  queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false, gcTime: Infinity}},
  })
})

afterEach(() => {
  forgetPostedComment(MINE)
  queryClient.clear()
})

it('reads the feed counts', async () => {
  mockCall.mockImplementation((_method, params) =>
    Promise.resolve(params.uris ? summaries : moments),
  )
  const {result} = renderHook(
    () => useMomentSummary({postUri: VIDEO, enabled: true}),
    {wrapper},
  )
  await waitFor(() => expect(counts(result.current.data)).toEqual([[41, 2]]))
  expect(mockCall).toHaveBeenCalledWith(expect.anything(), {uris: [VIDEO]})
})

it('shows a comment this app just posted before the service has it', async () => {
  // The service hasn't indexed the comment yet.
  const notIndexed = {
    ...moments,
    moments: [
      {
        ...moments.moments[0],
        replyCount: 2,
        replies: moments.moments[0].replies.filter(r => r.uri !== MINE),
      },
    ],
  }
  mockCall.mockImplementation((_method, params) =>
    Promise.resolve(params.uris ? summaries : notIndexed),
  )
  rememberPostedComment(queryClient, {
    uri: MINE,
    videoPostUri: VIDEO,
    seconds: 45,
  })
  const {result} = renderHook(
    () => useMomentSummary({postUri: VIDEO, enabled: true}),
    {wrapper},
  )
  await waitFor(() => expect(counts(result.current.data)).toEqual([[41, 3]]))
  expect(mockCall).toHaveBeenCalledWith(expect.anything(), {uri: VIDEO})
  expect(mockCall).not.toHaveBeenCalledWith(expect.anything(), {
    uris: [VIDEO],
  })
})

it('counts the comment once when the service has it', async () => {
  mockCall.mockImplementation((_method, params) =>
    Promise.resolve(params.uris ? summaries : moments),
  )
  rememberPostedComment(queryClient, {
    uri: MINE,
    videoPostUri: VIDEO,
    seconds: 45,
  })
  const {result} = renderHook(
    () => useMomentSummary({postUri: VIDEO, enabled: true}),
    {wrapper},
  )
  await waitFor(() => expect(mockCall).toHaveBeenCalled())
  await waitFor(() => expect(counts(result.current.data)).toEqual([[41, 3]]))
})

it('asks nothing when disabled', () => {
  rememberPostedComment(queryClient, {
    uri: MINE,
    videoPostUri: VIDEO,
    seconds: 45,
  })
  const {result} = renderHook(
    () => useMomentSummary({postUri: VIDEO, enabled: false}),
    {wrapper},
  )
  expect(result.current.data).toBeUndefined()
  expect(mockCall).not.toHaveBeenCalled()
})
