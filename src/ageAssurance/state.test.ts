import {computeAgeAssuranceState} from '#/ageAssurance/state'
import {AgeAssuranceAccess, AgeAssuranceStatus} from '#/ageAssurance/types'

jest.mock('#/ageAssurance/data', () => ({}))
jest.mock('#/ageAssurance/logger', () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
  },
}))
jest.mock('#/state/session', () => ({}))

const geolocation = {
  countryCode: undefined,
  regionCode: undefined,
}

describe('computeAgeAssuranceState', () => {
  it.each(['pending', 'error', 'success'] as const)(
    'blocks a known under-13 declaration when account data is %s',
    otherRequiredDataStatus => {
      expect(
        computeAgeAssuranceState({
          hasSession: true,
          geolocation,
          config: {regions: []},
          metadata: {declaredAge: 12, birthdate: undefined},
          otherRequiredDataStatus,
        }),
      ).toMatchObject({
        status: AgeAssuranceStatus.Blocked,
        access: AgeAssuranceAccess.None,
      })
    },
  )

  it.each(['pending', 'error', 'success'] as const)(
    'uses a cached adult declaration in unregulated regions when account data is %s',
    otherRequiredDataStatus => {
      expect(
        computeAgeAssuranceState({
          hasSession: true,
          geolocation,
          config: {regions: []},
          metadata: {declaredAge: 18, birthdate: undefined},
          otherRequiredDataStatus,
        }),
      ).toMatchObject({access: AgeAssuranceAccess.Full})
    },
  )

  it('avoids flashing the declaration gate while account data is pending', () => {
    expect(
      computeAgeAssuranceState({
        hasSession: true,
        geolocation,
        config: {regions: []},
        otherRequiredDataStatus: 'pending',
      }),
    ).toMatchObject({
      status: AgeAssuranceStatus.Unknown,
      access: AgeAssuranceAccess.Safe,
    })
  })

  it('fails open to Safe when the declaration backend fails', () => {
    expect(
      computeAgeAssuranceState({
        hasSession: true,
        geolocation,
        config: {regions: []},
        otherRequiredDataStatus: 'error',
      }),
    ).toEqual({
      status: AgeAssuranceStatus.Unknown,
      access: AgeAssuranceAccess.Safe,
      error: 'metadata',
    })
  })

  it('computes access after a successful response without a birthdate', () => {
    expect(
      computeAgeAssuranceState({
        hasSession: true,
        geolocation,
        config: {regions: []},
        metadata: {birthdate: undefined},
        otherRequiredDataStatus: 'success',
      }),
    ).toMatchObject({
      status: AgeAssuranceStatus.Unknown,
      access: AgeAssuranceAccess.None,
    })
  })

  it('preserves terminal server state with a cached declaration after a failed refresh', () => {
    expect(
      computeAgeAssuranceState({
        hasSession: true,
        geolocation: {countryCode: 'AA', regionCode: undefined},
        config: {
          regions: [
            {
              countryCode: 'AA',
              minAccessAge: 13,
              rules: [],
            },
          ],
        },
        state: {status: 'blocked', access: 'none'},
        metadata: {declaredAge: 18, birthdate: undefined},
        otherRequiredDataStatus: 'error',
      }),
    ).toMatchObject({
      status: AgeAssuranceStatus.Blocked,
      access: AgeAssuranceAccess.None,
    })
  })
})
