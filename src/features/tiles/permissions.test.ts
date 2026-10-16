import {type DatetimeString} from '@atproto/syntax'

import {type MuVerification} from '#/state/queries/verification/useMuVerificationQuery'
import {isTrustedTileAuthor} from './permissions'

/*
 * The verification query drags the session state in, which the test runner
 * cannot load; the rule under test never calls it.
 */
jest.mock('#/state/queries/verification/useMuVerificationQuery', () => ({}))

const DID = 'did:plc:rqbqpaaluty5v47jwciowpik'

function verification(overrides: Partial<MuVerification> = {}): MuVerification {
  return {verifications: [], isVerifier: false, ...overrides}
}

const verified = verification({
  verifications: [
    {
      issuer: 'did:plc:verifier',
      uri: 'at://did:plc:verifier/app.bsky.graph.verification/3abc',
      isValid: true,
      createdAt: '' as DatetimeString,
    },
  ],
})

describe('isTrustedTileAuthor', () => {
  it('trusts an author verified by a trusted verifier', () => {
    expect(isTrustedTileAuthor(DID, verified)).toBe(true)
  })

  it('trusts a trusted verifier', () => {
    expect(isTrustedTileAuthor(DID, verification({isVerifier: true}))).toBe(
      true,
    )
  })

  it('refuses an unverified author', () => {
    expect(isTrustedTileAuthor(DID, verification())).toBe(false)
  })

  it('refuses when the verification is unknown', () => {
    expect(isTrustedTileAuthor(DID, undefined)).toBe(false)
  })

  it('refuses a denylisted account whatever its verifications say', () => {
    expect(
      isTrustedTileAuthor(
        'did:plc:vc7f4oafdgxsihk4cry2xpze',
        verification({isVerifier: true}),
      ),
    ).toBe(false)
  })
})
