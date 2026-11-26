import {beforeEach, describe, expect, it, jest} from '@jest/globals'
import {act, renderHook} from '@testing-library/react-native'

import {
  registerSeekTarget,
  reportPlaybackPosition,
  resetPlaybackRegister,
} from '../playback'
import {usePauseAtMomentEnd} from '../usePauseAtMomentEnd'

const POST = 'at://did:plc:alice/app.bsky.feed.post/3lvideo'
const MOMENT = {startSeconds: 12, endSeconds: 17}

let pause: jest.Mock<() => void>

beforeEach(() => {
  resetPlaybackRegister()
  pause = jest.fn<() => void>()
  registerSeekTarget(POST, {seek: () => {}, pause, isActive: () => true})
})

/** Reports positions every half second, as the phone players do. */
function play(from: number, to: number) {
  for (let s = from; s <= to; s += 0.5) {
    act(() => reportPlaybackPosition(POST, s))
  }
}

describe('usePauseAtMomentEnd', () => {
  it('pauses when the video plays to the end of the moment', () => {
    renderHook(() => usePauseAtMomentEnd(POST, MOMENT))
    play(12, 16.5)
    expect(pause).not.toHaveBeenCalled()
    play(17, 17)
    expect(pause).toHaveBeenCalledTimes(1)
  })

  it('lets the video play on once it was paused', () => {
    renderHook(() => usePauseAtMomentEnd(POST, MOMENT))
    play(12, 30)
    expect(pause).toHaveBeenCalledTimes(1)
  })

  it('pauses again after going back into the moment', () => {
    renderHook(() => usePauseAtMomentEnd(POST, MOMENT))
    play(12, 20)
    play(12, 18)
    expect(pause).toHaveBeenCalledTimes(2)
  })

  it('does not pause when jumping past the end', () => {
    renderHook(() => usePauseAtMomentEnd(POST, MOMENT))
    play(12, 14)
    play(28, 30)
    expect(pause).not.toHaveBeenCalled()
  })

  it('follows the moment shown', () => {
    const {rerender} = renderHook(
      ({moment}: {moment: typeof MOMENT}) => usePauseAtMomentEnd(POST, moment),
      {initialProps: {moment: MOMENT}},
    )
    rerender({moment: {startSeconds: 40, endSeconds: 52}})
    play(12, 20)
    expect(pause).not.toHaveBeenCalled()
    play(40, 52)
    expect(pause).toHaveBeenCalledTimes(1)
  })

  it('does nothing without a moment', () => {
    renderHook(() => usePauseAtMomentEnd(POST, undefined))
    play(0, 30)
    expect(pause).not.toHaveBeenCalled()
  })
})
