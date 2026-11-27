import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {renderHook, waitFor} from '@testing-library/react-native'

import {type ThreadItem} from '#/state/queries/usePostThread/types'
import {forgetPostedComment, rememberPostedComment} from '../postedComments'
import {MEDIA_TIME_FIELD} from '../record'
import {fetchMoments, useVideoMoments} from '../useVideoMoments'

const VIDEO_POST = 'at://did:plc:alice/app.bsky.feed.post/3lvideo'

let mockEnabled = true
jest.mock('../config', () => ({
  get MEDIA_TIME_ENABLED() {
    return mockEnabled
  },
  MOMENTS_SERVICE_URL: 'https://moments.example',
}))

const mockCall = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockCreateServiceClient = jest.fn((_service: string) => ({
  call: mockCall,
}))
jest.mock('#/lib/lexClient', () => ({
  createServiceClient: (service: string) => mockCreateServiceClient(service),
}))

const serverAnswer = {
  uri: VIDEO_POST,
  replyCount: 3,
  moments: [
    {
      startSeconds: 41,
      endSeconds: 50,
      replyCount: 2,
      replies: [
        {uri: 'at://did:plc:b/app.bsky.feed.post/1', seconds: 41},
        {uri: 'at://did:plc:c/app.bsky.feed.post/2', seconds: 50},
      ],
    },
    {
      startSeconds: 200,
      endSeconds: 200,
      replyCount: 1,
      replies: [{uri: 'at://did:plc:d/app.bsky.feed.post/3', seconds: 200}],
    },
  ],
}

function reply(uri: string, seconds: number) {
  return {
    type: 'threadPost',
    uri,
    depth: 1,
    value: {
      post: {
        uri,
        record: {
          text: '',
          reply: {parent: {uri: VIDEO_POST}, root: {uri: VIDEO_POST}},
          [MEDIA_TIME_FIELD]: {$type: MEDIA_TIME_FIELD, seconds},
        },
      },
    },
  } as unknown as ThreadItem
}

function wrapper({children}: {children: React.ReactNode}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

let queryClient: QueryClient

beforeEach(() => {
  mockEnabled = true
  mockCall.mockReset()
  queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false, gcTime: Infinity}},
  })
})

afterEach(() => {
  queryClient.clear()
})

describe('fetchMoments', () => {
  it('asks the moments service and keeps its counts', async () => {
    mockCall.mockResolvedValue(serverAnswer)
    const moments = await fetchMoments(VIDEO_POST)
    expect(mockCreateServiceClient).toHaveBeenCalledWith(
      'https://moments.example',
    )
    expect(mockCall).toHaveBeenCalledWith(expect.anything(), {uri: VIDEO_POST})
    expect(moments.map(m => [m.startSeconds, m.endSeconds, m.count])).toEqual([
      [41, 50, 2],
      [200, 200, 1],
    ])
  })

  it("keeps which comments the video's author answered, when the service says", async () => {
    const [first, second] = serverAnswer.moments
    mockCall.mockResolvedValue({
      ...serverAnswer,
      moments: [
        {
          ...first,
          unansweredCount: 1,
          replies: [
            {...first.replies[0], authorReplied: true},
            first.replies[1],
          ],
        },
        second,
      ],
    })
    const [answered, older] = await fetchMoments(VIDEO_POST)
    expect(answered).toEqual({
      startSeconds: 41,
      endSeconds: 50,
      count: 2,
      unansweredCount: 1,
      comments: [
        {
          uri: 'at://did:plc:b/app.bsky.feed.post/1',
          seconds: 41,
          authorReplied: true,
        },
        {uri: 'at://did:plc:c/app.bsky.feed.post/2', seconds: 50},
      ],
    })
    // a service that doesn't count them leaves them unknown
    expect(older).not.toHaveProperty('unansweredCount')
  })
})

describe('useVideoMoments', () => {
  const localItems = [
    reply('at://did:plc:b/app.bsky.feed.post/1', 41),
    reply('at://did:plc:e/app.bsky.feed.post/new', 205),
  ]

  it('adds loaded replies the service does not know to its moments', async () => {
    mockCall.mockResolvedValue(serverAnswer)
    const {result} = renderHook(
      () =>
        useVideoMoments({videoPostUri: VIDEO_POST, threadItems: localItems}),
      {wrapper},
    )
    await waitFor(() =>
      expect(result.current.map(m => [m.startSeconds, m.count])).toEqual([
        [41, 2],
        [200, 2],
      ]),
    )
  })

  it('groups the loaded replies when the service fails', async () => {
    mockCall.mockRejectedValue(new Error('MethodNotImplemented'))
    const {result} = renderHook(
      () =>
        useVideoMoments({videoPostUri: VIDEO_POST, threadItems: localItems}),
      {wrapper},
    )
    await waitFor(() => expect(mockCall).toHaveBeenCalled())
    // each moment starts 5 seconds before its only comment
    expect(result.current.map(m => [m.startSeconds, m.count])).toEqual([
      [36, 1],
      [200, 1],
    ])
  })

  describe('with a comment this app just posted', () => {
    const mine = 'at://did:plc:me/app.bsky.feed.post/mine'
    afterEach(() => forgetPostedComment(mine))

    it('shows it before the service knows it', async () => {
      mockCall.mockResolvedValue(serverAnswer)
      rememberPostedComment(queryClient, {
        uri: mine,
        videoPostUri: VIDEO_POST,
        seconds: 45,
      })
      const {result} = renderHook(
        () => useVideoMoments({videoPostUri: VIDEO_POST, threadItems: []}),
        {wrapper},
      )
      await waitFor(() =>
        expect(result.current.map(m => [m.startSeconds, m.count])).toEqual([
          [41, 3],
          [200, 1],
        ]),
      )
    })

    it('counts it once when the service and the thread have it too', async () => {
      mockCall.mockResolvedValue({
        ...serverAnswer,
        moments: [
          {
            ...serverAnswer.moments[0],
            replyCount: 3,
            replies: [
              ...serverAnswer.moments[0].replies,
              {uri: mine, seconds: 45},
            ],
          },
          serverAnswer.moments[1],
        ],
      })
      rememberPostedComment(queryClient, {
        uri: mine,
        videoPostUri: VIDEO_POST,
        seconds: 45,
      })
      const {result} = renderHook(
        () =>
          useVideoMoments({
            videoPostUri: VIDEO_POST,
            threadItems: [reply(mine, 45)],
          }),
        {wrapper},
      )
      await waitFor(() => expect(mockCall).toHaveBeenCalled())
      await waitFor(() =>
        expect(result.current.map(m => [m.startSeconds, m.count])).toEqual([
          [41, 3],
          [200, 1],
        ]),
      )
    })
  })

  it('does not ask the service when the feature is off', () => {
    mockEnabled = false
    renderHook(
      () =>
        useVideoMoments({videoPostUri: VIDEO_POST, threadItems: localItems}),
      {wrapper},
    )
    expect(mockCall).not.toHaveBeenCalled()
  })

  it('does not ask the service when disabled', () => {
    renderHook(
      () =>
        useVideoMoments({
          videoPostUri: VIDEO_POST,
          threadItems: localItems,
          enabled: false,
        }),
      {wrapper},
    )
    expect(mockCall).not.toHaveBeenCalled()
  })
})
