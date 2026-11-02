import {describe, expect, it} from '@jest/globals'

import {articleBands} from './layout'

describe('newspaper bands', () => {
  it('keeps small stories in two-column rows, never three across', () => {
    expect(articleBands(['small', 'small', 'small', 'small'])).toEqual([
      {main: 0, aside: [1], columns: 'repeat(2, minmax(0, 1fr))'},
      {main: 2, aside: [3], columns: 'repeat(2, minmax(0, 1fr))'},
    ])
  })

  it('keeps two small supporting stories beside a two-thirds lead', () => {
    expect(
      articleBands(['medium', 'small', 'small', 'small', 'small']),
    ).toEqual([
      {main: 0, aside: [1, 2], columns: 'minmax(0, 2fr) minmax(0, 1fr)'},
      {main: 3, aside: [4], columns: 'repeat(2, minmax(0, 1fr))'},
    ])
  })

  it('gives a big story its own full-width band', () => {
    expect(articleBands(['big', 'small', 'small'])).toEqual([
      {main: 0, aside: [], columns: 'minmax(0, 1fr)'},
      {main: 1, aside: [2], columns: 'repeat(2, minmax(0, 1fr))'},
    ])
  })

  it('preserves reading order with mixed sizes and an odd final story', () => {
    const bands = articleBands([
      'small',
      'medium',
      'big',
      'medium',
      'small',
      'big',
      'small',
    ])
    expect(bands.flatMap(band => [band.main, ...band.aside])).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ])
    expect(bands.at(-1)?.aside).toEqual([])
  })
})
