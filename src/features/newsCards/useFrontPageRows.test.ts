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

it('never reshapes a complete trailing row when more stories load', () => {
  const ids = (count: number) => keys(count)
  const flags = [true, false, false, false, true, false]
  const {result, rerender} = renderHook(
    ({count}: {count: number}) =>
      useFrontPageRows(ids(count), flags.slice(0, count), 3),
    {initialProps: {count: 4}},
  )
  const before = result.current
  expect(before).toHaveLength(2)
  rerender({count: 6})
  expect(result.current.slice(0, 2)).toEqual(before)
})

it('fills a row that was cut short when the stories ran out', () => {
  const {result, rerender} = renderHook(
    ({count}: {count: number}) =>
      useFrontPageRows(keys(count), Array(count).fill(true), 3),
    {initialProps: {count: 2}},
  )
  expect(result.current[1]).toMatchObject({
    type: 'cards',
    cells: [{index: 1, span: 2}],
  })
  rerender({count: 3})
  expect(result.current[1]).toMatchObject({
    type: 'cards',
    cells: [
      {index: 1, span: 2},
      {index: 2, span: 1},
    ],
  })
})

it('plans again on four columns, and back on three, when the width crosses the boundary', () => {
  const {result, rerender} = renderHook(
    ({columns}: {columns: 1 | 2 | 3 | 4}) =>
      useFrontPageRows(keys(9), media(9), columns),
    {initialProps: {columns: 3}},
  )
  rerender({columns: 4})
  expect(result.current).toEqual(planRows(media(9), 4))
  rerender({columns: 3})
  expect(result.current).toEqual(planRows(media(9), 3))
})
