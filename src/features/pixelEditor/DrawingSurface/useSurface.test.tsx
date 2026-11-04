import {act, renderHook} from '@testing-library/react-native'

import {useSurface} from './useSurface'

it('maps zoomed drawing coordinates and pans without painting on either platform', () => {
  const start = jest.fn()
  const move = jest.fn()
  const end = jest.fn()
  const {result, rerender} = renderHook(
    ({pan}: {pan: boolean}) =>
      useSurface({
        size: 256,
        zoom: 2,
        pan,
        label: '',
        hint: '',
        onStart: start,
        onMove: move,
        onEnd: end,
      }),
    {initialProps: {pan: false}},
  )
  act(() => result.current.start(0, 0))
  expect(start).toHaveBeenLastCalledWith({x: 16, y: 16})
  act(() => {
    result.current.move(128, 128)
    result.current.end()
  })
  expect(move).toHaveBeenLastCalledWith({x: 32, y: 32})
  expect(end).toHaveBeenCalledTimes(1)
  rerender({pan: true})
  act(() => {
    result.current.start(100, 100)
    result.current.move(164, 164)
    result.current.end()
  })
  expect(result.current.offset).toEqual({x: -64, y: -64})
  expect(start).toHaveBeenCalledTimes(1)
  expect(end).toHaveBeenCalledTimes(1)
  rerender({pan: false})
  act(() => result.current.start(0, 0))
  expect(start).toHaveBeenLastCalledWith({x: 8, y: 8})
  act(() => result.current.move(-1, 0))
  expect(move).toHaveBeenLastCalledWith(null)
})

it('bounds pan offsets, recenters on zoom/resize, and reveals keyboard pixels', () => {
  const {result, rerender} = renderHook(
    ({zoom}: {zoom: number}) =>
      useSurface({
        size: 256,
        zoom,
        pan: true,
        label: '',
        hint: '',
        onStart: jest.fn(),
        onMove: jest.fn(),
        onEnd: jest.fn(),
      }),
    {initialProps: {zoom: 2}},
  )
  act(() => {
    result.current.start(0, 0)
    result.current.move(1000, 1000)
    result.current.end()
  })
  expect(result.current.offset).toEqual({x: 0, y: 0})
  act(() => result.current.reveal({x: 63, y: 63}))
  expect(result.current.offset.x).toBeLessThan(0)
  rerender({zoom: 1})
  expect(result.current.offset).toEqual({x: 0, y: 0})
})
