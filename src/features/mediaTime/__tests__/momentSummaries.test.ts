import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals'

import {
  loadMomentSummary,
  MAX_SUMMARY_URIS,
  SUMMARY_BATCH_WAIT_MS,
  topMoments,
} from '../momentSummaries'

jest.mock('../config', () => ({
  MEDIA_TIME_ENABLED: true,
  MOMENTS_SERVICE_URL: 'https://moments.example',
}))

const mockCall =
  jest.fn<(method: unknown, params: {uris: string[]}) => Promise<unknown>>()
jest.mock('#/lib/lexClient', () => ({
  createServiceClient: () => ({call: mockCall}),
}))

const post = (n: number) => `at://did:plc:a/app.bsky.feed.post/${n}`

function answerFor(uris: string[]) {
  return {
    summaries: uris.map((uri, i) => ({
      uri,
      replyCount: i + 1,
      moments: [
        {startSeconds: i * 100, endSeconds: i * 100, replyCount: i + 1},
      ],
    })),
  }
}

beforeEach(() => {
  jest.useFakeTimers()
  mockCall.mockReset()
  mockCall.mockImplementation((_method, {uris}) =>
    Promise.resolve(answerFor(uris)),
  )
})

afterEach(() => {
  jest.useRealTimers()
})

async function flushBatch() {
  await jest.advanceTimersByTimeAsync(SUMMARY_BATCH_WAIT_MS)
}

describe('loadMomentSummary', () => {
  it('asks once for posts requested close together', async () => {
    const results = Promise.all([
      loadMomentSummary(post(1)),
      loadMomentSummary(post(2)),
      loadMomentSummary(post(1)),
    ])
    await flushBatch()
    const [first, second, again] = await results

    expect(mockCall).toHaveBeenCalledTimes(1)
    expect(mockCall.mock.calls[0][1]).toEqual({uris: [post(1), post(2)]})
    expect(first).toEqual([
      {startSeconds: 0, endSeconds: 0, count: 1, comments: []},
    ])
    expect(second[0].count).toBe(2)
    expect(again).toEqual(first)
  })

  it('splits more posts than one request allows', async () => {
    const uris = Array.from({length: MAX_SUMMARY_URIS + 5}, (_, i) => post(i))
    const results = Promise.all(uris.map(uri => loadMomentSummary(uri)))
    await flushBatch()
    await results

    expect(mockCall.mock.calls.map(call => call[1].uris.length)).toEqual([
      MAX_SUMMARY_URIS,
      5,
    ])
  })

  it('fails every post of a request that fails', async () => {
    mockCall.mockRejectedValueOnce(new Error('MethodNotImplemented'))
    const first = loadMomentSummary(post(1))
    const second = loadMomentSummary(post(2))
    const expectations = Promise.all([
      expect(first).rejects.toThrow('MethodNotImplemented'),
      expect(second).rejects.toThrow('MethodNotImplemented'),
    ])
    await flushBatch()
    await expectations
  })

  it('answers no moments for a post the service left out', async () => {
    mockCall.mockResolvedValueOnce({summaries: []})
    const result = loadMomentSummary(post(1))
    await flushBatch()
    expect(await result).toEqual([])
  })
})

describe('topMoments', () => {
  const moment = (startSeconds: number, count: number) => ({
    startSeconds,
    endSeconds: startSeconds,
    count,
    comments: [],
  })

  it('keeps the three with the most comments, most first', () => {
    expect(
      topMoments([
        moment(10, 3),
        moment(100, 9),
        moment(200, 4),
        moment(300, 5),
        moment(400, 9),
      ]).map(m => m.startSeconds),
    ).toEqual([100, 400, 300])
  })

  it('returns fewer when there are fewer', () => {
    expect(topMoments([moment(10, 3)])).toHaveLength(1)
    expect(topMoments([])).toEqual([])
  })

  it('leaves out groups too small to be a moment', () => {
    expect(
      topMoments([moment(10, 2), moment(20, 1), moment(30, 3)]).map(
        m => m.startSeconds,
      ),
    ).toEqual([30])
  })
})
