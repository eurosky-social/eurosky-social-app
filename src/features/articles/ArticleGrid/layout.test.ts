import {describe, expect, it} from '@jest/globals'

import {articleBands, automaticArticleSize, defaultArticleSize} from './layout'

function readingOrder(band: ReturnType<typeof articleBands>[number]) {
  return band.reversed ? [...band.aside, band.main] : [band.main, ...band.aside]
}

describe('newspaper bands', () => {
  it('stacks two small stories to the left of a right-hand feature without reordering them', () => {
    expect(articleBands(['small', 'small', 'medium'])).toEqual([
      {
        main: 2,
        aside: [0, 1],
        columns: 'minmax(0, 1fr) minmax(0, 2fr)',
        reversed: true,
      },
    ])
  })
  it('never creates an automatic reversed split with only one supporting story', () => {
    const mixed = articleBands([
      'small',
      'medium',
      'big',
      'small',
      'small',
      'medium',
    ])
    expect(
      mixed
        .filter(band => band.reversed)
        .every(band => band.aside.length === 2),
    ).toBe(true)
    expect(mixed.flatMap(readingOrder)).toEqual([0, 1, 2, 3, 4, 5])
    expect(mixed[0].columns).toBe('repeat(2, minmax(0, 1fr))')
  })
  it('does not leave an empty second column for an orphan beside a full-width post', () => {
    expect(articleBands(['small', 'big'])[0].columns).toBe('minmax(0, 1fr)')
  })
  it('gives bare posts a normal full-width row instead of an empty illustrated hero', () => {
    expect(automaticArticleSize({}, 0)).toBe('big')
    expect(
      automaticArticleSize({image: 'https://example.com/image.jpg'}, 0),
    ).toBe('medium')
    expect(
      automaticArticleSize({image: 'https://example.com/image.jpg'}, 5),
    ).toBe('big')
  })
  it('automatically varies pairs, full-width features and reversed splits without reordering posts', () => {
    const bands = articleBands(
      Array.from({length: 15}, (_, index) => defaultArticleSize(index)),
    )
    expect(bands.map(band => band.columns)).toEqual([
      'minmax(0, 2fr) minmax(0, 1fr)',
      'repeat(2, minmax(0, 1fr))',
      'minmax(0, 1fr)',
      'minmax(0, 1fr) minmax(0, 2fr)',
      'minmax(0, 1fr) minmax(0, 2fr)',
      'repeat(2, minmax(0, 1fr))',
      'minmax(0, 1fr)',
    ])
    expect(bands.flatMap(readingOrder)).toEqual(
      Array.from({length: 15}, (_, index) => index),
    )
    expect(defaultArticleSize(15)).toBe(defaultArticleSize(0))
  })
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
    expect(bands.flatMap(readingOrder)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(bands.at(-1)?.aside).toEqual([])
  })
})
