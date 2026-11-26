import {beforeEach, expect, it, jest} from '@jest/globals'

import {openWatching} from '../openWatching'
import {reportPlaybackPosition, resetPlaybackRegister} from '../playback'

const mockNavigate = jest.fn((_route: unknown) => Promise.resolve())
jest.mock('#/Navigation', () => ({
  navigate: (route: unknown) => mockNavigate(route),
}))

const VIDEO = 'at://did:plc:alice/app.bsky.feed.post/3lvideo'

beforeEach(() => {
  mockNavigate.mockClear()
  resetPlaybackRegister()
})

it('opens the video with its moments from the start', () => {
  openWatching(VIDEO)
  expect(mockNavigate).toHaveBeenCalledWith({
    name: 'PostVideo',
    params: {name: 'did:plc:alice', rkey: '3lvideo'},
  })
})

it('goes on from where the video was just watched', () => {
  reportPlaybackPosition(VIDEO, 41.6, 300)
  openWatching(VIDEO)
  expect(mockNavigate).toHaveBeenCalledWith({
    name: 'PostVideo',
    params: {name: 'did:plc:alice', rkey: '3lvideo', t: '41'},
  })
})
