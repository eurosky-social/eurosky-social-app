import {parseTilesPolicy, TILES_POLICY_REPO} from './policy'

describe('parseTilesPolicy', () => {
  it('reads the switch and a trimmed message', () => {
    expect(parseTilesPolicy({enabled: false})).toEqual({enabled: false})
    expect(parseTilesPolicy({enabled: true, message: ''})).toEqual({
      enabled: true,
    })
    expect(
      parseTilesPolicy({
        $type: 'social.mu.tiles.policy',
        enabled: false,
        message: '  Back soon.  ',
        updatedAt: '2026-11-06T12:00:00.000Z',
      }),
    ).toEqual({enabled: false, message: 'Back soon.'})
  })

  it('reads anything malformed as "tiles play"', () => {
    expect(parseTilesPolicy(undefined)).toEqual({enabled: true})
    expect(parseTilesPolicy('no')).toEqual({enabled: true})
    expect(parseTilesPolicy({})).toEqual({enabled: true})
    expect(parseTilesPolicy({enabled: 'false'})).toEqual({enabled: true})
    expect(parseTilesPolicy({enabled: false, message: 42})).toEqual({
      enabled: false,
    })
  })
})

describe('TILES_POLICY_REPO', () => {
  it('is the creator of the trusted-verifier list', () => {
    expect(TILES_POLICY_REPO).toMatch(/^did:/)
  })
})
