import {renderHook} from '@testing-library/react-native'

import {type ArticleSize} from '../articles'
import {articleBands, defaultArticleSize} from './layout'
import {useArticleBands} from './useArticleBands'

function props(sizes: ArticleSize[]) {
  return {keys: sizes.map((_, index) => `post-${index}`), sizes}
}

it.each([
  ['medium'],
  ['medium', 'small'],
  ['small'],
  ['small', 'small'],
] satisfies ArticleSize[][])(
  'keeps an incomplete %j band unchanged when more stories arrive',
  (...initial) => {
    const sizes = initial as ArticleSize[]
    const {result, rerender} = renderHook(
      ({keys, sizes}: ReturnType<typeof props>) => useArticleBands(keys, sizes),
      {initialProps: props(sizes)},
    )
    const before = result.current
    rerender(props([...sizes, 'medium', 'small', 'small']))
    expect(result.current.slice(0, before.length)).toEqual(before)
    expect(result.current[0]).toBe(before[0])
  },
)

it('keeps every existing band stable over multiple page appends without gaps or duplicates', () => {
  const sizes = Array.from({length: 120}, (_, index) =>
    defaultArticleSize(index),
  )
  const {result, rerender} = renderHook(
    ({keys, sizes}: ReturnType<typeof props>) => useArticleBands(keys, sizes),
    {initialProps: props(sizes.slice(0, 1))},
  )
  for (const count of [2, 8, 25, 51, 67, 120]) {
    const before = result.current
    rerender(props(sizes.slice(0, count)))
    expect(result.current.slice(0, before.length)).toEqual(before)
    expect(
      result.current.flatMap(band =>
        band.reversed ? [...band.aside, band.main] : [band.main, ...band.aside],
      ),
    ).toEqual(Array.from({length: count}, (_, index) => index))
    expect(
      result.current
        .filter(band => band.reversed)
        .every(band => band.aside.length === 1),
    ).toBe(true)
  }
})

it('retains grouping across ordinary rerenders and width changes', () => {
  const {result, rerender} = renderHook(
    ({keys, sizes}: ReturnType<typeof props>) => useArticleBands(keys, sizes),
    {initialProps: props(['small', 'small'])},
  )
  const before = result.current
  rerender(props(['small', 'small']))
  expect(result.current).toBe(before)
})

it('regroups after refresh, reordering, filtering, or a media-size change', () => {
  const sizes: ArticleSize[] = ['small', 'small', 'medium']
  const {result, rerender} = renderHook(
    ({keys, sizes}: ReturnType<typeof props>) => useArticleBands(keys, sizes),
    {initialProps: props(sizes.slice(0, 2))},
  )
  rerender(props(sizes))
  expect(result.current).toHaveLength(2)
  rerender({keys: ['new-post', 'post-0', 'post-1'], sizes})
  expect(result.current).toEqual(articleBands(sizes))
  rerender(props(['big', 'small', 'medium']))
  expect(result.current).toEqual(articleBands(['big', 'small', 'medium']))
  rerender(props(['small']))
  expect(result.current).toEqual(articleBands(['small']))
  rerender(props([]))
  expect(result.current).toEqual([])
})
