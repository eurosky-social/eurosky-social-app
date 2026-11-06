import {describe, expect, it} from '@jest/globals'

import {type ArticleSize} from '../articles'
import {articleBands, automaticArticleSize, defaultArticleSize} from './layout'

function readingOrder(band: ReturnType<typeof articleBands>[number]) {
  return band.reversed ? [...band.aside, band.main] : [band.main, ...band.aside]
}

describe('newspaper bands', () => {
  it('pairs a lead with only one small story, leaving later stories in chronological rows', () => {
    expect(articleBands(['medium', 'small', 'small', 'small'])).toEqual([
      {main: 0, aside: [1], columns: 'minmax(0, 2fr) minmax(0, 1fr)'},
      {main: 2, aside: [3], columns: 'repeat(2, minmax(0, 1fr))'},
    ])
  })
  it('puts one small story to the left of a right-hand feature without reordering', () => {
    expect(articleBands(['small', 'medium'])).toEqual([
      {
        main: 1,
        aside: [0],
        columns: 'minmax(0, 1fr) minmax(0, 2fr)',
        reversed: true,
      },
    ])
  })
  it('never stacks two supporting stories or drops/reorders stories, including arbitrary saved editorial sizes', () => {
    const choices: ArticleSize[] = ['small', 'medium', 'big']
    for (let length = 1; length <= 5; length++) {
      for (let value = 0; value < 3 ** length; value++) {
        const sizes = Array.from(
          {length},
          (_, index) => choices[Math.floor(value / 3 ** index) % 3],
        )
        const bands = articleBands(sizes)
        expect(bands.every(band => band.aside.length <= 1)).toBe(true)
        expect(bands.flatMap(readingOrder)).toEqual(
          Array.from({length}, (_, index) => index),
        )
      }
    }
  })
  it('does not leave an empty second column for an orphan beside a full-width post', () => {
    expect(articleBands(['small', 'big'])[0].columns).toBe('minmax(0, 1fr)')
  })
  it('gives bare posts a normal full-width row rather than an empty illustrated hero', () => {
    expect(automaticArticleSize({}, 0)).toBe('big')
    expect(
      automaticArticleSize({image: 'https://example.com/image.jpg'}, 0),
    ).toBe('medium')
    expect(
      automaticArticleSize({image: 'https://example.com/image.jpg'}, 4),
    ).toBe('big')
  })
  it('varies forward features, pairs, full-width stories and reversed features without orphan small stories', () => {
    const sizes = Array.from({length: 14}, (_, index) =>
      defaultArticleSize(index),
    )
    const bands = articleBands(sizes)
    expect(bands.map(band => band.columns)).toEqual([
      'minmax(0, 2fr) minmax(0, 1fr)',
      'repeat(2, minmax(0, 1fr))',
      'minmax(0, 1fr)',
      'minmax(0, 1fr) minmax(0, 2fr)',
      'repeat(2, minmax(0, 1fr))',
      'minmax(0, 2fr) minmax(0, 1fr)',
      'minmax(0, 1fr) minmax(0, 2fr)',
      'minmax(0, 1fr)',
    ])
    expect(bands.flatMap(readingOrder)).toEqual(
      Array.from({length: 14}, (_, index) => index),
    )
    expect(
      bands
        .filter(band => band.aside.length === 0)
        .every(band => sizes[band.main] === 'big'),
    ).toBe(true)
    expect(defaultArticleSize(14)).toBe(defaultArticleSize(0))
  })
  it('keeps small stories in two-column rows, never three across', () => {
    expect(articleBands(['small', 'small', 'small', 'small'])).toEqual([
      {main: 0, aside: [1], columns: 'repeat(2, minmax(0, 1fr))'},
      {main: 2, aside: [3], columns: 'repeat(2, minmax(0, 1fr))'},
    ])
  })
  it('gives a big story its own full-width band', () => {
    expect(articleBands(['big', 'small', 'small'])).toEqual([
      {main: 0, aside: [], columns: 'minmax(0, 1fr)'},
      {main: 1, aside: [2], columns: 'repeat(2, minmax(0, 1fr))'},
    ])
  })
})
