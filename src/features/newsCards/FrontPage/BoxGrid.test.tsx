import {StyleSheet, Text, type ViewStyle} from 'react-native'
import {render, screen} from '@testing-library/react-native'

import {type PlannedRow} from '../slotting'
import {BoxGrid} from './BoxGrid'

jest.mock('#/alf', () => ({
  atoms: new Proxy({}, {get: () => ({})}),
  useTheme: () => ({
    atoms: new Proxy({}, {get: () => ({borderColor: '#333'})}),
  }),
}))

type CardsRow = Extract<PlannedRow, {type: 'cards'}>
const rows: CardsRow[] = [
  {
    type: 'cards',
    cells: [
      {index: 0, span: 2},
      {index: 1, span: 1},
    ],
  },
  {
    type: 'cards',
    cells: [
      {index: 2, span: 1},
      {index: 3, span: 1},
    ],
  },
]

function style(testID: string) {
  return (
    StyleSheet.flatten(screen.getByTestId(testID).props.style as ViewStyle[]) ??
    {}
  )
}

beforeEach(() => {
  render(
    <BoxGrid
      testID="grid"
      rows={rows}
      columns={3}
      renderCell={cell => <Text>{cell.index}</Text>}
    />,
  )
})

it('draws only the top and left edges on the frame', () => {
  expect(style('grid')).toMatchObject({borderTopWidth: 1, borderLeftWidth: 1})
  expect(style('grid')).not.toHaveProperty('borderRightWidth')
  expect(style('grid')).not.toHaveProperty('borderBottomWidth')
})

it('gives every cell only its right and bottom edge, so no line is doubled', () => {
  for (const id of ['boxCell-0', 'boxCell-1', 'boxCell-2', 'boxCell-3']) {
    expect(style(id)).toMatchObject({borderRightWidth: 1, borderBottomWidth: 1})
    expect(style(id)).not.toHaveProperty('borderTopWidth')
    expect(style(id)).not.toHaveProperty('borderLeftWidth')
  }
})

it('stretches cells to the full row height and pads inside them', () => {
  expect(style('frontPageRow-2-1')).toMatchObject({
    flexDirection: 'row',
    alignItems: 'stretch',
  })
  expect(style('frontPageRow-2-1')).not.toHaveProperty('paddingTop')
  expect(style('boxCell-0')).toMatchObject({padding: 20})
})

it('sizes cells by span and lets the last card of a short row fill it', () => {
  expect(style('boxCell-0').width).toBe(`${(2 / 3) * 100}%`)
  expect(style('boxCell-1').width).toBe(`${(1 / 3) * 100}%`)
  expect(style('boxCell-2').width).toBe(`${(1 / 3) * 100}%`)
  expect(style('boxCell-3')).toMatchObject({flex: 1})
  expect(style('boxCell-3')).not.toHaveProperty('width')
})
