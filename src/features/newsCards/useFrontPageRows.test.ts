import {renderHook} from '@testing-library/react-native'

import {planRows, reflowRows} from './slotting'
import {useFrontPageRows} from './useFrontPageRows'

const keys = (count: number) =>
  Array.from({length: count}, (_, index) => `story-${index}`)
const media = (count: number) =>
  Array.from({length: count}, (_, index) => index % 3 !== 1)

it('keeps every row but the last stable when stories are appended', () => {
  const {result, rerender} = renderHook(
    ({count}: {count: number}) =>
      useFrontPageRows(keys(count), media(count), 3, {shorts: true}),
    {initialProps: {count: 8}},
  )
  const before = result.current
  rerender({count: 20})
  expect(result.current.slice(0, before.length - 1)).toEqual(
    before.slice(0, -1),
  )
  const placed = result.current.flatMap(row =>
    row.type === 'cards' ? row.cells.map(cell => cell.index) : [],
  )
  expect(placed.sort((x, y) => x - y)).toEqual(keys(20).map((_, i) => i))
})

it('replans from scratch when existing stories change order', () => {
  const {result, rerender} = renderHook(
    ({ids}: {ids: string[]}) => useFrontPageRows(ids, media(ids.length), 3),
    {initialProps: {ids: keys(8)}},
  )
  rerender({ids: [...keys(8)].reverse()})
  expect(result.current).toEqual(planRows(media(8), 3))
})

it('reflows the same plan when the column count changes', () => {
  const {result, rerender} = renderHook(
    ({columns}: {columns: 1 | 2 | 3}) =>
      useFrontPageRows(keys(9), media(9), columns),
    {initialProps: {columns: 3 as 1 | 2 | 3}},
  )
  const three = result.current
  rerender({columns: 2})
  expect(result.current).toEqual(reflowRows(three, 2))
})
