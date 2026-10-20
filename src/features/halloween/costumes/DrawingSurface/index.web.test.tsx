/** @jest-environment jsdom */
import {act} from 'react'
import {createRoot} from 'react-dom/client'

import {DrawingSurface} from './index.web'

const start = jest.fn()
const move = jest.fn()
const end = jest.fn()
let container: HTMLDivElement
let canvas: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  jest.clearAllMocks()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() =>
    root.render(
      <DrawingSurface
        size={256}
        label="Canvas"
        hint="Arrow keys and Space"
        onStart={start}
        onMove={move}
        onEnd={end}
      />,
    ),
  )
  canvas = container.querySelector('[data-testid="costumeDrawingSurface"]')!
  canvas.getBoundingClientRect = () =>
    ({left: 10, top: 20, width: 256, height: 256}) as DOMRect
  canvas.setPointerCapture = jest.fn()
  canvas.releasePointerCapture = jest.fn()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function pointer(type: string, x: number, y: number, patch = {}) {
  const event = new Event(type, {bubbles: true, cancelable: true})
  Object.assign(event, {
    pointerId: 1,
    isPrimary: true,
    button: 0,
    clientX: x,
    clientY: y,
    ...patch,
  })
  act(() => {
    canvas.dispatchEvent(event)
  })
}

it('captures primary mouse, pen, and touch drags and releases outside the canvas', () => {
  pointer('pointerdown', 138, 84)
  expect(start).toHaveBeenCalledWith({x: 32, y: 16})
  expect(canvas.setPointerCapture).toHaveBeenCalledWith(1)
  pointer('pointermove', 146, 92)
  expect(move).toHaveBeenLastCalledWith({x: 34, y: 18})
  pointer('pointermove', 400, 500)
  expect(move).toHaveBeenLastCalledWith(null)
  pointer('pointerup', 400, 500)
  expect(end).toHaveBeenCalledTimes(1)
  expect(canvas.releasePointerCapture).toHaveBeenCalledWith(1)
  pointer('pointermove', 138, 84)
  expect(move).toHaveBeenCalledTimes(3)
})

it('ignores secondary buttons and extra pointers, and ends canceled strokes once', () => {
  pointer('pointerdown', 138, 84, {button: 2})
  pointer('pointerdown', 138, 84, {isPrimary: false})
  expect(start).not.toHaveBeenCalled()
  pointer('pointerdown', 138, 84)
  pointer('pointermove', 200, 200, {pointerId: 2})
  pointer('pointerup', 200, 200, {pointerId: 2})
  pointer('pointercancel', 200, 200, {pointerId: 2})
  expect(move).not.toHaveBeenCalled()
  expect(end).not.toHaveBeenCalled()
  pointer('pointercancel', 138, 84)
  pointer('lostpointercapture', 138, 84)
  expect(end).toHaveBeenCalledTimes(1)
})

it('offers keyboard drawing without trapping Tab', () => {
  const key = (value: string) => {
    const event = new KeyboardEvent('keydown', {
      key: value,
      bubbles: true,
      cancelable: true,
    })
    act(() => {
      canvas.dispatchEvent(event)
    })
    return event
  }
  key('ArrowRight')
  key('ArrowDown')
  key(' ')
  expect(start).toHaveBeenLastCalledWith({x: 33, y: 33})
  expect(end).toHaveBeenCalledTimes(1)
  expect(key('Tab').defaultPrevented).toBe(false)
})

it('uses coalesced pen samples before the final pointer position', () => {
  pointer('pointerdown', 138, 84)
  pointer('pointermove', 146, 92, {
    getCoalescedEvents: () => [{clientX: 142, clientY: 88}],
  })
  expect(move.mock.calls).toEqual([[{x: 33, y: 17}], [{x: 34, y: 18}]])
})

it('supports Command/Control Z and Shift Z while keeping shortcuts local to the canvas', () => {
  const undo = jest.fn()
  const redo = jest.fn()
  act(() =>
    root.render(
      <DrawingSurface
        size={256}
        label="Canvas"
        hint="Keyboard"
        onStart={start}
        onMove={move}
        onEnd={end}
        onUndo={undo}
        onRedo={redo}
      />,
    ),
  )
  const undoEvent = new KeyboardEvent('keydown', {
    key: 'z',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  })
  const redoEvent = new KeyboardEvent('keydown', {
    key: 'Z',
    metaKey: true,
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  })
  act(() => {
    canvas.dispatchEvent(undoEvent)
    canvas.dispatchEvent(redoEvent)
  })
  expect(undo).toHaveBeenCalledTimes(1)
  expect(redo).toHaveBeenCalledTimes(1)
  expect(undoEvent.defaultPrevented).toBe(true)
  expect(redoEvent.defaultPrevented).toBe(true)
})

function gestureCanvas(
  extra: Partial<React.ComponentProps<typeof DrawingSurface>> = {},
) {
  act(() =>
    root.render(
      <DrawingSurface
        size={256}
        gestures
        label="Canvas"
        hint="Gestures"
        onStart={start}
        onMove={move}
        onEnd={end}
        {...extra}
      />,
    ),
  )
}

it('accepts non-primary touch pointers for two/three-finger taps and rolls back first-finger marks', () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000)
  const undo = jest.fn()
  const redo = jest.fn()
  const cancel = jest.fn()
  gestureCanvas({onUndo: undo, onRedo: redo, onCancel: cancel})
  pointer('pointerdown', 90, 148, {pointerType: 'touch'})
  pointer('pointerdown', 186, 148, {
    pointerType: 'touch',
    pointerId: 2,
    isPrimary: false,
  })
  pointer('pointerup', 90, 148, {pointerType: 'touch'})
  pointer('lostpointercapture', 90, 148, {pointerType: 'touch'})
  pointer('pointerup', 186, 148, {
    pointerType: 'touch',
    pointerId: 2,
    isPrimary: false,
  })
  expect(undo).toHaveBeenCalledTimes(1)
  expect(cancel).toHaveBeenCalledTimes(1)
  expect(end).not.toHaveBeenCalled()
  pointer('pointerdown', 90, 148, {pointerType: 'touch'})
  pointer('pointerdown', 186, 148, {
    pointerType: 'touch',
    pointerId: 2,
    isPrimary: false,
  })
  pointer('pointerdown', 138, 100, {
    pointerType: 'touch',
    pointerId: 3,
    isPrimary: false,
  })
  for (const [pointerId, x, y] of [
    [1, 90, 148],
    [2, 186, 148],
    [3, 138, 100],
  ])
    pointer('pointerup', x, y, {pointerType: 'touch', pointerId})
  expect(redo).toHaveBeenCalledTimes(1)
  expect(undo).toHaveBeenCalledTimes(1)
  now.mockRestore()
})

it('pinches on touch without undoing and without resuming a stroke with the last finger', () => {
  const undo = jest.fn()
  gestureCanvas({onUndo: undo, onCancel: jest.fn()})
  pointer('pointerdown', 90, 148, {pointerType: 'touch'})
  pointer('pointerdown', 186, 148, {
    pointerType: 'touch',
    pointerId: 2,
    isPrimary: false,
  })
  pointer('pointermove', 42, 148, {pointerType: 'touch'})
  pointer('pointermove', 234, 148, {pointerType: 'touch', pointerId: 2})
  expect(
    container
      .querySelector('[data-testid="costumeCanvasTransform"]')
      ?.getAttribute('style'),
  ).toContain('scale(2)')
  pointer('pointerup', 42, 148, {pointerType: 'touch'})
  pointer('pointermove', 220, 148, {pointerType: 'touch', pointerId: 2})
  pointer('pointerup', 220, 148, {pointerType: 'touch', pointerId: 2})
  expect(move).not.toHaveBeenCalled()
  expect(undo).not.toHaveBeenCalled()
})

it('handles non-passive trackpad pinch, scroll-to-pan, and WebKit gestures without double zooming', () => {
  gestureCanvas()
  const wheel = (patch = {}) => {
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: 138,
      clientY: 148,
      deltaY: -Math.log(2) * 100,
      ctrlKey: true,
      ...patch,
    })
    act(() => {
      canvas.dispatchEvent(event)
    })
    return event
  }
  expect(wheel().defaultPrevented).toBe(true)
  const transform = () =>
    container
      .querySelector('[data-testid="costumeCanvasTransform"]')!
      .getAttribute('style')
  expect(transform()).toContain('scale(2)')
  wheel({ctrlKey: false, deltaX: 10, deltaY: 20})
  expect(transform()).toContain('translate(-138px, -148px)')
  const safari = (type: string, scale: number) => {
    const event = new Event(type, {cancelable: true})
    Object.assign(event, {scale, clientX: 138, clientY: 148})
    act(() => {
      canvas.dispatchEvent(event)
    })
  }
  safari('gesturestart', 1)
  safari('gesturechange', 2)
  expect(transform()).toContain('scale(4)')
  wheel()
  expect(transform()).toContain('scale(4)')
  safari('gestureend', 2)
  wheel()
  expect(transform()).toContain('scale(8)')
})
