import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import {act, renderHook} from '@testing-library/react-native'

import {
  MEDIA_TIME_NUDGE_SECONDS,
  resolveComposerMediaTime,
  useComposerMediaTime,
} from '../composer'
import {getMediaTimeLinkGraphemes} from '../record'

let mockEnabled = true
jest.mock('../config', () => ({
  get MEDIA_TIME_ENABLED() {
    return mockEnabled
  },
}))

beforeEach(() => {
  mockEnabled = true
})

const VIDEO_POST = 'at://did:plc:alice/app.bsky.feed.post/3lvideo'
const video = {
  $type: 'app.bsky.embed.video#view',
  cid: 'bafy',
  playlist: 'https://video.example/playlist.m3u8',
}

describe('resolveComposerMediaTime', () => {
  const watched = jest.fn<(uri: string) => number | undefined>(() => 41)

  it('uses the time the caller passed', () => {
    expect(
      resolveComposerMediaTime({
        explicit: 12,
        replyTo: {uri: VIDEO_POST, embed: video as never},
        getWatchedSeconds: watched,
      }),
    ).toBe(12)
  })

  it('falls back to where the video was just watched', () => {
    expect(
      resolveComposerMediaTime({
        explicit: undefined,
        replyTo: {uri: VIDEO_POST, embed: video as never},
        getWatchedSeconds: watched,
      }),
    ).toBe(41)
    expect(watched).toHaveBeenCalledWith(VIDEO_POST)
  })

  it('needs a reply to a post with its own video', () => {
    expect(
      resolveComposerMediaTime({
        explicit: 12,
        replyTo: undefined,
        getWatchedSeconds: watched,
      }),
    ).toBeUndefined()
    expect(
      resolveComposerMediaTime({
        explicit: 12,
        replyTo: {
          uri: VIDEO_POST,
          embed: {$type: 'app.bsky.embed.images#view'} as never,
        },
        getWatchedSeconds: watched,
      }),
    ).toBeUndefined()
  })

  it('ignores videos shown as GIFs', () => {
    expect(
      resolveComposerMediaTime({
        explicit: 12,
        replyTo: {
          uri: VIDEO_POST,
          embed: {...video, presentation: 'gif'} as never,
        },
        getWatchedSeconds: watched,
      }),
    ).toBeUndefined()
  })

  it('does nothing while the build switch is off', () => {
    mockEnabled = false
    expect(
      resolveComposerMediaTime({
        explicit: 12,
        replyTo: {uri: VIDEO_POST, embed: video as never},
        getWatchedSeconds: watched,
      }),
    ).toBeUndefined()
  })
})

describe('useComposerMediaTime', () => {
  it('is unavailable without a starting time', () => {
    const {result} = renderHook(() => useComposerMediaTime(undefined))
    expect(result.current.available).toBe(false)
    expect(result.current.value).toBeUndefined()
    expect(result.current.reservedGraphemes).toBe(0)
  })

  it('publishes the starting time and reserves room for the link', () => {
    const {result} = renderHook(() => useComposerMediaTime(41))
    expect(result.current.value).toBe(41)
    expect(result.current.reservedGraphemes).toBe(getMediaTimeLinkGraphemes(41))
  })

  it('moves the time in steps and never below zero', () => {
    const {result} = renderHook(() => useComposerMediaTime(3))
    act(() => result.current.nudge(MEDIA_TIME_NUDGE_SECONDS))
    expect(result.current.value).toBe(8)
    act(() => result.current.nudge(-MEDIA_TIME_NUDGE_SECONDS))
    act(() => result.current.nudge(-MEDIA_TIME_NUDGE_SECONDS))
    expect(result.current.value).toBe(0)
  })

  it('can be unlinked and linked again at the starting time', () => {
    const {result} = renderHook(() => useComposerMediaTime(41))
    act(() => result.current.nudge(MEDIA_TIME_NUDGE_SECONDS))
    act(() => result.current.detach())
    expect(result.current.value).toBeUndefined()
    expect(result.current.reservedGraphemes).toBe(0)
    act(() => result.current.reattach())
    expect(result.current.value).toBe(41)
  })

  it('is unavailable while the build switch is off', () => {
    mockEnabled = false
    const {result} = renderHook(() => useComposerMediaTime(41))
    expect(result.current.available).toBe(false)
    expect(result.current.value).toBeUndefined()
  })
})
