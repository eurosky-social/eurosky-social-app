import {router} from '#/routes'
import {makeEventLink} from './util'

describe('makeEventLink', () => {
  it('opens the event page with the DID and record key', () => {
    const link = makeEventLink({did: 'did:plc:abc', rkey: '3kxyz'})
    expect(router.matchPath(link)).toEqual([
      'Event',
      {name: 'did:plc:abc', rkey: '3kxyz'},
    ])
  })
})
