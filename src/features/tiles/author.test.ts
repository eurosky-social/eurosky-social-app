import {tileAuthorActor} from './author'

/*
 * The queries and the identity resolver drag the session state in, which the
 * test runner cannot load; the parsing under test never calls them.
 */
jest.mock('#/state/queries', () => ({}))
jest.mock('#/state/queries/profile', () => ({}))
jest.mock('#/state/queries/verification/useMuVerificationQuery', () => ({}))
jest.mock('#/state/session/resolve-pds', () => ({}))

const DID = 'did:plc:rqbqpaaluty5v47jwciowpik'

describe('tileAuthorActor', () => {
  it('is the DID of a canonical tile URI', () => {
    expect(tileAuthorActor(`at://${DID}/ing.dasl.masl/3mx6h2wjtgq2h`)).toBe(DID)
  })

  it('is the handle when the URI carries one', () => {
    expect(
      tileAuthorActor({uri: 'at://pyxorium.com/ing.dasl.masl/3mx6h2wjtgq2h'}),
    ).toBe('pyxorium.com')
  })

  it('is undefined for anything that is not a tile URI', () => {
    expect(
      tileAuthorActor(`at://${DID}/app.bsky.feed.post/3abc`),
    ).toBeUndefined()
    expect(tileAuthorActor('https://mu.social/')).toBeUndefined()
  })
})
