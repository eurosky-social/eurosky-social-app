import {beforeEach, expect, it, jest} from '@jest/globals'

import {openMoment} from '../openMoment'

const mockNavigate = jest.fn((_route: unknown) => Promise.resolve())
jest.mock('#/Navigation', () => ({
  navigate: (route: unknown) => mockNavigate(route),
}))

beforeEach(() => {
  mockNavigate.mockClear()
})

it("opens the moment's page at its second", () => {
  openMoment('at://did:plc:alice/app.bsky.feed.post/3lvideo', 36)
  expect(mockNavigate).toHaveBeenCalledWith({
    name: 'PostMoment',
    params: {name: 'did:plc:alice', rkey: '3lvideo', t: '36'},
  })
})

it('does nothing for an address that is not a post', () => {
  openMoment('not a uri', 36)
  expect(mockNavigate).not.toHaveBeenCalled()
})
