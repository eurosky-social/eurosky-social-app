import {beforeEach, describe, expect, it, jest} from '@jest/globals'

import {
  getCommentableMediaTime,
  getPlaybackSecond,
  POSITION_MAX_AGE_MS,
  QUEUED_SEEK_MAX_AGE_MS,
  queueSeek,
  registerSeekTarget,
  reportPlaybackPosition,
  resetPlaybackRegister,
  seekIfVisible,
  subscribePlaybackPositions,
} from '../playback'

const POST = 'at://did:plc:alice/app.bsky.feed.post/3lvideo'
const NOW = 1_000_000

beforeEach(() => {
  resetPlaybackRegister()
})

function target(active = true) {
  return {seek: jest.fn<(seconds: number) => void>(), isActive: () => active}
}

describe('getCommentableMediaTime', () => {
  it('returns the whole second last reported', () => {
    reportPlaybackPosition(POST, 41.7, 120, NOW)
    expect(getCommentableMediaTime(POST, NOW + 1000)).toBe(41)
  })

  it('knows nothing about videos that were not played', () => {
    expect(getCommentableMediaTime(POST, NOW)).toBeUndefined()
  })

  it('ignores the first second, when nothing was really watched yet', () => {
    reportPlaybackPosition(POST, 0.4, 120, NOW)
    expect(getCommentableMediaTime(POST, NOW)).toBeUndefined()
  })

  it('ignores a video watched to the end', () => {
    reportPlaybackPosition(POST, 119.5, 120, NOW)
    expect(getCommentableMediaTime(POST, NOW)).toBeUndefined()
  })

  it('works without a known duration', () => {
    reportPlaybackPosition(POST, 300, undefined, NOW)
    expect(getCommentableMediaTime(POST, NOW)).toBe(300)
  })

  it('forgets old positions', () => {
    reportPlaybackPosition(POST, 41, 120, NOW)
    expect(
      getCommentableMediaTime(POST, NOW + POSITION_MAX_AGE_MS + 1),
    ).toBeUndefined()
  })

  it('ignores invalid positions', () => {
    reportPlaybackPosition(POST, 41, 120, NOW)
    reportPlaybackPosition(POST, NaN, 120, NOW)
    reportPlaybackPosition(POST, -1, 120, NOW)
    expect(getCommentableMediaTime(POST, NOW)).toBe(41)
  })
})

describe('seek targets', () => {
  it('jumps in the most recently registered active player', () => {
    const behind = target(true)
    const front = target(true)
    registerSeekTarget(POST, behind)
    registerSeekTarget(POST, front)
    expect(seekIfVisible(POST, 41)).toBe(true)
    expect(front.seek).toHaveBeenCalledWith(41)
    expect(behind.seek).not.toHaveBeenCalled()
  })

  it('skips players on screens the user is not looking at', () => {
    const visible = target(true)
    const hidden = target(false)
    registerSeekTarget(POST, visible)
    registerSeekTarget(POST, hidden)
    expect(seekIfVisible(POST, 41)).toBe(true)
    expect(visible.seek).toHaveBeenCalledWith(41)
    expect(hidden.seek).not.toHaveBeenCalled()
  })

  it('reports when no player can jump', () => {
    expect(seekIfVisible(POST, 41)).toBe(false)
    registerSeekTarget(POST, target(false))
    expect(seekIfVisible(POST, 41)).toBe(false)
  })

  it('stops using a player after it unregisters', () => {
    const player = target(true)
    const unregister = registerSeekTarget(POST, player)
    unregister()
    expect(seekIfVisible(POST, 41)).toBe(false)
    expect(player.seek).not.toHaveBeenCalled()
  })

  it('hands a queued jump to the next player that registers', () => {
    queueSeek(POST, 41, NOW)
    const player = target(true)
    registerSeekTarget(POST, player, NOW + 1000)
    expect(player.seek).toHaveBeenCalledWith(41)

    const later = target(true)
    registerSeekTarget(POST, later, NOW + 2000)
    expect(later.seek).not.toHaveBeenCalled()
  })

  it('drops a queued jump that waited too long', () => {
    queueSeek(POST, 41, NOW)
    const player = target(true)
    registerSeekTarget(POST, player, NOW + QUEUED_SEEK_MAX_AGE_MS + 1)
    expect(player.seek).not.toHaveBeenCalled()
  })
})

describe('getPlaybackSecond and subscribePlaybackPositions', () => {
  it('gives the whole second last reported', () => {
    expect(getPlaybackSecond(POST)).toBeUndefined()
    reportPlaybackPosition(POST, 41.7, 300, NOW)
    expect(getPlaybackSecond(POST)).toBe(41)
  })

  it('tells listeners when a video reaches another whole second', () => {
    const listener = jest.fn()
    const stop = subscribePlaybackPositions(listener)
    reportPlaybackPosition(POST, 41.2, 300, NOW)
    reportPlaybackPosition(POST, 41.7, 300, NOW)
    expect(listener).toHaveBeenCalledTimes(1)
    reportPlaybackPosition(POST, 42.1, 300, NOW)
    expect(listener).toHaveBeenCalledTimes(2)
    stop()
    reportPlaybackPosition(POST, 50, 300, NOW)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
