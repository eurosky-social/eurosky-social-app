import {act, renderHook} from '@testing-library/react-native'

import {createCostume, isEmpty, TRANSPARENT} from './model'
import {useDrawing} from './useDrawing'

function editor() {
  const initial = createCostume()
  const limit = jest.fn()
  return {...renderHook(() => useDrawing(initial, limit)), initial, limit}
}

it('commits one undo step per complete stroke and restores palettes on undo/redo', () => {
  const {result, initial} = editor()
  act(() => result.current.selectColor('#123ABC'))
  expect(result.current.dirty).toBe(false)
  act(() => {
    result.current.start({x: 10, y: 10})
    result.current.move({x: 20, y: 10})
    result.current.end()
  })
  const painted = result.current.costume
  expect(painted.palette.at(-1)).toBe('#123ABC')
  expect(
    painted.pixels.filter(pixel => pixel === painted.palette.length - 1).length,
  ).toBeGreaterThan(10)
  expect(result.current.dirty).toBe(true)
  act(() => result.current.undo())
  expect(result.current.costume).toEqual(initial)
  expect(result.current.dirty).toBe(false)
  expect(result.current.canUndo).toBe(false)
  act(() => result.current.redo())
  expect(result.current.costume).toEqual(painted)
})

it('previews straight lines without leaving earlier preview positions in the art', () => {
  const {result} = editor()
  act(() => {
    result.current.setTool('line')
    result.current.setBrushSize(1)
  })
  act(() => {
    result.current.start({x: 10, y: 10})
    result.current.move({x: 20, y: 10})
    result.current.move({x: 10, y: 20})
    result.current.end()
  })
  expect(result.current.costume.pixels[10 * 64 + 20]).toBe(TRANSPARENT)
  expect(result.current.costume.pixels[20 * 64 + 10]).toBe(2)
  expect(
    result.current.costume.pixels.filter(pixel => pixel !== TRANSPARENT),
  ).toHaveLength(11)
})

it('fills once per tap, supports erasing, and resets redo when drawing again', () => {
  const {result} = editor()
  act(() => result.current.setTool('fill'))
  act(() => {
    result.current.start({x: 32, y: 32})
    result.current.move({x: 0, y: 0})
    result.current.end()
  })
  expect(result.current.costume.pixels.every(pixel => pixel === 2)).toBe(true)
  act(() => {
    result.current.setTool('eraser')
    result.current.setBrushSize(8)
  })
  act(() => {
    result.current.start({x: 32, y: 32})
    result.current.end()
  })
  expect(result.current.costume.pixels[32 * 64 + 32]).toBe(TRANSPARENT)
  act(() => result.current.undo())
  expect(result.current.canRedo).toBe(true)
  act(() => result.current.clear())
  expect(isEmpty(result.current.costume)).toBe(true)
  expect(result.current.canRedo).toBe(false)
  act(() => result.current.undo())
  expect(result.current.costume.pixels.every(pixel => pixel === 2)).toBe(true)
})

it('breaks out-of-bounds strokes instead of connecting across the canvas', () => {
  const {result} = editor()
  act(() => result.current.setBrushSize(1))
  act(() => {
    result.current.start({x: 0, y: 0})
    result.current.move(null)
    result.current.move({x: 63, y: 63})
    result.current.end()
  })
  expect(
    result.current.costume.pixels.filter(pixel => pixel !== TRANSPARENT),
  ).toHaveLength(2)
})

it('never paints with the hand tool and chooses a color without mutating old pixels', () => {
  const {result, initial} = editor()
  act(() => result.current.setTool('pan'))
  act(() => {
    result.current.start({x: 10, y: 10})
    result.current.move({x: 20, y: 20})
    result.current.end()
  })
  expect(result.current.costume).toEqual(initial)
  act(() => result.current.selectColor('#FFFFFF'))
  expect(result.current.tool).toBe('brush')
  expect(result.current.dirty).toBe(false)
})

it('rolls back an interrupted fill/brush transaction without touching redo or recent colors', () => {
  const used = jest.fn()
  const initial = createCostume()
  const {result} = renderHook(() =>
    useDrawing(initial, jest.fn(), {onColorUsed: used}),
  )
  act(() => {
    result.current.start({x: 32, y: 32})
    result.current.end()
    result.current.undo()
  })
  expect(result.current.canRedo).toBe(true)
  used.mockClear()
  act(() => result.current.setTool('fill'))
  act(() => {
    result.current.start({x: 32, y: 32})
    result.current.cancel()
  })
  expect(result.current.costume).toEqual(initial)
  expect(result.current.canRedo).toBe(true)
  expect(result.current.canUndo).toBe(false)
  expect(used).not.toHaveBeenCalled()
})

it('samples painted colors before photo colors, commits no history, and returns to the painting tool', () => {
  const initial = createCostume()
  initial.pixels[32 * 64 + 32] = 4
  const samplePhoto = jest.fn(() => '#123456')
  const {result} = renderHook(() =>
    useDrawing(initial, jest.fn(), {samplePhoto}),
  )
  act(() => {
    result.current.setTool('fill')
  })
  act(() => result.current.setTool('eyedropper'))
  act(() => {
    result.current.start({x: 32, y: 32})
    result.current.end()
  })
  expect(result.current.color).toBe('#ED445E')
  expect(result.current.tool).toBe('fill')
  expect(samplePhoto).not.toHaveBeenCalled()
  expect(result.current.canUndo).toBe(false)
  act(() => result.current.setTool('eyedropper'))
  act(() => {
    result.current.start({x: 30, y: 30})
    result.current.end()
  })
  expect(result.current.color).toBe('#123456')
  expect(result.current.dirty).toBe(false)
})

it('restores the selected color if an eyedropper gesture becomes multi-touch', () => {
  const initial = createCostume()
  const {result} = renderHook(() =>
    useDrawing(initial, jest.fn(), {samplePhoto: () => '#123456'}),
  )
  act(() => result.current.setTool('eyedropper'))
  act(() => result.current.start({x: 32, y: 32}))
  expect(result.current.color).toBe('#123456')
  act(() => result.current.cancel())
  expect(result.current.color).toBe('#FF8A24')
  expect(result.current.tool).toBe('eyedropper')
  expect(result.current.canUndo).toBe(false)
})

it('defers fill until release and returns the committed snapshot for Save', () => {
  const {result} = editor()
  act(() => result.current.setTool('fill'))
  act(() => result.current.start({x: 32, y: 32}))
  expect(isEmpty(result.current.costume)).toBe(true)
  let saved = createCostume()
  act(() => {
    saved = result.current.end()
  })
  expect(saved.pixels.every(pixel => pixel === 2)).toBe(true)
  expect(saved).toBe(result.current.costume)
})
