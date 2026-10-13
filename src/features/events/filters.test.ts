import {
  readEventFilters,
  readEventSort,
  toEventListParams,
  withEventFilterParams,
  withEventSortParam,
} from './filters'

describe('readEventFilters', () => {
  it('reads valid params and drops invalid ones', () => {
    expect(
      readEventFilters({location: ' utrecht ', from: '2026-10-01', to: 'soon'}),
    ).toEqual({location: 'utrecht', from: '2026-10-01'})
  })

  it('round-trips through the route params', () => {
    const filters = {location: 'utrecht', from: '2026-10-01', to: '2026-10-31'}
    expect(readEventFilters(withEventFilterParams({}, filters))).toEqual(
      filters,
    )
  })
})

describe('withEventFilterParams', () => {
  it('drops cleared filters and keeps other params', () => {
    expect(
      withEventFilterParams(
        {feed: 'mine', location: 'utrecht', from: '2026-10-01'},
        {location: ' ', to: '2026-10-31'},
      ),
    ).toEqual({feed: 'mine', to: '2026-10-31'})
  })
})

describe('toEventListParams', () => {
  it('omits inactive filters so they never clear feed defaults', () => {
    expect(toEventListParams({})).toEqual({})
  })

  it('covers whole local days', () => {
    expect(toEventListParams({from: '2026-10-01', to: '2026-10-31'})).toEqual({
      startsAtMin: new Date(2026, 9, 1).toISOString(),
      startsAtMax: new Date(2026, 9, 31, 23, 59, 59, 999).toISOString(),
    })
  })
})

describe('event sort params', () => {
  it('defaults to date for a missing or unknown sort', () => {
    expect(readEventSort({})).toBe('date')
    expect(readEventSort({sort: 'nope'})).toBe('date')
  })

  it('leaves the default sort out of the route params', () => {
    expect(withEventSortParam({feed: 'mine', sort: 'recent'}, 'date')).toEqual({
      feed: 'mine',
    })
    expect(withEventSortParam({feed: 'mine'}, 'recent')).toEqual({
      feed: 'mine',
      sort: 'recent',
    })
  })
})
