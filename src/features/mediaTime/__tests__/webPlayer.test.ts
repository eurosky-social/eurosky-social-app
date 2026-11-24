import {describe, expect, it, jest} from '@jest/globals'

import {seekWhenReady} from '../webPlayer'

function fakeVideo(readyState: number) {
  const listeners: Record<string, () => void> = {}
  const video = {
    readyState,
    currentTime: 0,
    addEventListener: jest.fn((type: string, listener: () => void) => {
      listeners[type] = listener
    }),
  }
  return {video, listeners}
}

describe('seekWhenReady', () => {
  it('seeks right away once the metadata is loaded', () => {
    const {video} = fakeVideo(1)
    seekWhenReady(video as never, 41)
    expect(video.currentTime).toBe(41)
    expect(video.addEventListener).not.toHaveBeenCalled()
  })

  it('waits for the metadata before seeking', () => {
    const {video, listeners} = fakeVideo(0)
    seekWhenReady(video as never, 41)
    expect(video.currentTime).toBe(0)
    listeners.loadedmetadata()
    expect(video.currentTime).toBe(41)
  })
})
