import {describe, expect, it} from '@jest/globals'

import {getNoAccessReason} from '#/ageAssurance/noAccessReason'

const declaredAdult = {
  hasDeclaredAge: true,
  isOverAppMinAccessAge: true,
  isAARegion: true,
  isOverRegionMinAccessAge: true,
}

describe('getNoAccessReason', () => {
  it('asks for an age first', () => {
    expect(
      getNoAccessReason({
        ...declaredAdult,
        hasDeclaredAge: false,
        isOverAppMinAccessAge: false,
        isOverRegionMinAccessAge: false,
      }),
    ).toBe('undeclared')
  })

  it('blocks under 13 everywhere', () => {
    expect(
      getNoAccessReason({
        ...declaredAdult,
        isAARegion: false,
        isOverAppMinAccessAge: false,
        isOverRegionMinAccessAge: false,
      }),
    ).toBe('under-app-min')
  })

  it('blocks a declared age below the region minimum', () => {
    expect(
      getNoAccessReason({...declaredAdult, isOverRegionMinAccessAge: false}),
    ).toBe('under-region-min')
  })

  /*
   * US-MS: minimum age 18 and no declared-age rule, so a declared adult only
   * gets in by verifying. The gate has to offer verification rather than say
   * the app is unavailable (EUR-501).
   */
  it('offers verification to a declared adult in a verified-age-only region', () => {
    expect(getNoAccessReason(declaredAdult)).toBe('needs-verification')
  })
})
