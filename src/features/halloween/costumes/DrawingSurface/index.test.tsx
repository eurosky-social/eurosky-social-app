import {fireEvent, render} from '@testing-library/react-native'

import {DrawingSurface} from './index'

const touch = (identifier: number, x: number, y: number) => ({
  identifier,
  locationX: x,
  locationY: y,
  pageX: 1000 + x,
  pageY: 2000 + y,
})
const a = touch(1, 80, 128)
const b = touch(2, 176, 128)
const c = touch(3, 128, 80)
function native(touches: ReturnType<typeof touch>[], changedTouches = touches) {
  return {
    nativeEvent: {
      touches,
      changedTouches,
      pageX: 1080,
      pageY: 2128,
      locationX: 80,
      locationY: 128,
    },
  }
}
function surface() {
  const callbacks = {
    onStart: jest.fn(),
    onMove: jest.fn(),
    onEnd: jest.fn(),
    onCancel: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
  }
  const screen = render(
    <DrawingSurface
      size={256}
      gestures
      label="Canvas"
      hint="Gestures"
      {...callbacks}
    />,
  )
  return {
    ...screen,
    canvas: screen.getByTestId('costumeDrawingSurface'),
    ...callbacks,
  }
}
beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(1000)
})
afterEach(() => jest.restoreAllMocks())

it('recognizes stationary multi-finger taps from responder start/end, without needing movement', () => {
  const s = surface()
  fireEvent(s.canvas, 'responderGrant', native([a]))
  fireEvent(
    s.canvas,
    'responderStart',
    native([a, {...b, locationX: 5, locationY: 5}]),
  )
  fireEvent(s.canvas, 'responderEnd', native([b], [a]))
  fireEvent(s.canvas, 'responderEnd', native([], [b]))
  fireEvent(s.canvas, 'responderRelease', native([], [b]))
  expect(s.onCancel).toHaveBeenCalledTimes(1)
  expect(s.onEnd).not.toHaveBeenCalled()
  expect(s.onUndo).toHaveBeenCalledTimes(1)
  fireEvent(s.canvas, 'responderGrant', native([a]))
  fireEvent(s.canvas, 'responderStart', native([a, b, c]))
  fireEvent(s.canvas, 'responderEnd', native([], [a, b, c]))
  expect(s.onRedo).toHaveBeenCalledTimes(1)
  expect(s.onUndo).toHaveBeenCalledTimes(1)
})

it('pinches using canvas-relative page coordinates and ignores the remaining finger until release', () => {
  const s = surface()
  fireEvent(s.canvas, 'responderGrant', native([a]))
  fireEvent(s.canvas, 'responderStart', native([a, b]))
  const movedA = touch(1, 32, 128)
  const movedB = touch(2, 224, 128)
  fireEvent(s.canvas, 'responderMove', native([movedA, movedB]))
  expect(
    (
      s.getByTestId('costumeCanvasTransform').props.style as {
        transform: {scale?: number}[]
      }
    ).transform,
  ).toContainEqual({scale: 2})
  fireEvent(s.canvas, 'responderEnd', native([movedB], [movedA]))
  fireEvent(s.canvas, 'responderMove', native([touch(2, 200, 128)]))
  fireEvent(s.canvas, 'responderRelease', native([], [movedB]))
  expect(s.onMove).not.toHaveBeenCalled()
  expect(s.onUndo).not.toHaveBeenCalled()
  expect(s.onRedo).not.toHaveBeenCalled()
})
