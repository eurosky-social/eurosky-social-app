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
  it('reads a province from the world scope, filtered by category', () => {
    expect(sourceForRegion('nl-utrecht')).toEqual({
      source: 'dutch',
      scope: 'all',
      filters: [{category: 'nl-utrecht'}],
    })
  })

  it('reads the Netherlands like any other country', () => {
    expect(sourceForRegion('netherlands')).toEqual({
      source: 'dutch',
      scope: 'all',
      filters: [{countries: ['nl']}],
    })
  })

  it('reads another country from the world scope, filtered by country', () => {
    expect(sourceForRegion('uk')).toEqual({
      source: 'dutch',
      scope: 'all',
      filters: [{countries: ['gb']}],
    })
  })

  it('has nothing for a region with no filter', () => {
    expect(sourceForRegion('europe')).toBeUndefined()
  })
})
