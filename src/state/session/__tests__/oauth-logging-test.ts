import {describe, expect, it} from '@jest/globals'

import {describeOAuthError, redactDid} from '../oauth-logging'

const FIRST_DID = 'did:plc:alice123'
const SECOND_DID = 'did:web:example.com:users:bob'

describe('OAuth error logging', () => {
  it('replaces DIDs with stable, distinguishable fingerprints', () => {
    const description = redactDid(
      `Session ${FIRST_DID} replaced ${FIRST_DID}, not ${SECOND_DID}`,
    )

    expect(description).toBe(
      'Session did:[redacted-e6722] replaced did:[redacted-e6722], not did:[redacted-c2b22]',
    )
    expect(description).not.toContain(FIRST_DID)
    expect(description).not.toContain(SECOND_DID)
  })

  it('unwraps OAuth response fields and redacts messages', () => {
    const responseError = Object.assign(
      new Error(`OAuth error for ${SECOND_DID}`),
      {
        error: 'invalid_grant',
        errorDescription: `Token revoked for ${SECOND_DID}`,
        status: 400,
      },
    )
    const refreshError = new Error(`Refresh failed for ${FIRST_DID}`, {
      cause: responseError,
    })

    expect(describeOAuthError(refreshError)).toEqual({
      kind: 'Error',
      safeMessage: 'Refresh failed for did:[redacted-e6722]',
      oauthError: 'invalid_grant',
      status: 400,
      detail: 'Token revoked for did:[redacted-c2b22]',
    })
  })

  it('describes string errors without exposing their DIDs', () => {
    expect(describeOAuthError(`Store failed for ${FIRST_DID}`)).toEqual({
      kind: 'string',
      safeMessage: 'Store failed for did:[redacted-e6722]',
    })
  })
})
