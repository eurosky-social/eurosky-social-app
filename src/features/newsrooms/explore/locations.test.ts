import {pickerRegions, sourceForRegion} from './locations'

jest.mock('../dutch/config', () => ({
  ...jest.requireActual('../dutch/config'),
  IS_DUTCH_API_CONFIGURED: true,
}))

const ids = (regions: {id: string}[]) => regions.map(region => region.id)

describe('pickerRegions', () => {
  it('offers the world, then only the showable regions picked', () => {
    expect(ids(pickerRegions(['europe', 'nl-utrecht', 'global']))).toEqual([
      'global',
      'nl-utrecht',
    ])
  })

  it('offers every showable region when none are picked', () => {
    const offered = ids(pickerRegions(['europe']))
    expect(offered[0]).toBe('global')
    expect(offered).toContain('france')
    expect(offered).toContain('nl-zuid-holland')
    expect(offered).not.toContain('europe')
  })
})

describe('sourceForRegion', () => {
  it('reads a province from the Dutch scope, filtered by the server', () => {
    expect(sourceForRegion('nl-utrecht')).toEqual({
      source: 'dutch',
      scope: 'dutch',
      category: 'nl-utrecht',
    })
  })

  it('reads another country from the world scope, filtered by country', () => {
    expect(sourceForRegion('uk')).toEqual({
      source: 'dutch',
      scope: 'all',
      country: 'gb',
    })
  })

  it('has nothing for a region with no filter', () => {
    expect(sourceForRegion('europe')).toBeUndefined()
  })
})
