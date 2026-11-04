import {SurfaceController, type SurfaceOptions} from './controller'

function surface(options: Partial<SurfaceOptions> = {}) {
  const callbacks = {
    onStart: jest.fn(),
    onMove: jest.fn(),
    onEnd: jest.fn(),
    onCancel: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
  }
  const changed = jest.fn()
  const controller = new SurfaceController(
    () => ({size: 256, gestures: true, ...callbacks, ...options}),
    changed,
  )
  return {controller, changed, ...callbacks}
}
const a = {id: 1, x: 80, y: 128}
const b = {id: 2, x: 176, y: 128}
const c = {id: 3, x: 128, y: 80}

it('rolls back the first mark, then undoes only after both fingers lift', () => {
  const s = surface()
  s.controller.touchDown(a, 0)
  s.controller.touchDown(b, 30)
  expect(s.onStart).toHaveBeenCalledTimes(1)
  expect(s.onCancel).toHaveBeenCalledTimes(1)
  expect(s.onEnd).not.toHaveBeenCalled()
  s.controller.touchUp(1, 80)
  s.controller.touchCancel(1)
  expect(s.onUndo).not.toHaveBeenCalled()
  s.controller.touchUp(2, 100)
  expect(s.onUndo).toHaveBeenCalledTimes(1)
  expect(s.onRedo).not.toHaveBeenCalled()
})

it('redoes a three-finger tap without also undoing', () => {
  const s = surface()
  for (const point of [a, b, c]) s.controller.touchDown(point, 10)
  for (const id of [3, 1, 2]) s.controller.touchUp(id, 100)
  expect(s.onRedo).toHaveBeenCalledTimes(1)
  expect(s.onUndo).not.toHaveBeenCalled()
  expect(s.onCancel).toHaveBeenCalledTimes(1)
})

it('pinches around the finger centroid and never interprets the pinch as a history tap', () => {
  const s = surface()
  s.controller.touchDown(a, 0)
  s.controller.touchDown(b, 20)
  s.controller.touchMove({...a, x: 32})
  s.controller.touchMove({...b, x: 224})
  expect(s.controller.view).toEqual({scale: 2, x: -128, y: -128})
  expect(s.controller.position(128, 128)).toEqual({x: 32, y: 32})
  s.controller.touchUp(1, 150)
  s.controller.touchMove({...b, x: 200})
  s.controller.touchUp(2, 160)
  expect(s.onMove).not.toHaveBeenCalled()
  expect(s.onUndo).not.toHaveBeenCalled()
  expect(s.onRedo).not.toHaveBeenCalled()
})

it('pans with two fingers and tolerates stationary tap jitter without zooming', () => {
  const s = surface()
  s.controller.reset(2)
  s.controller.touchDown(a, 0)
  s.controller.touchDown(b, 20)
  s.controller.touchMove({...a, x: a.x + 20})
  s.controller.touchMove({...b, x: b.x + 20})
  expect(s.controller.view).toEqual({scale: 2, x: -108, y: -128})
  s.controller.touchUp(1, 100)
  s.controller.touchUp(2, 120)
  expect(s.onUndo).not.toHaveBeenCalled()
  s.controller.touchDown(a, 200)
  s.controller.touchDown(b, 210)
  s.controller.touchMove({...a, x: a.x + 1})
  s.controller.touchMove({...b, x: b.x - 1})
  s.controller.touchUp(1, 240)
  s.controller.touchUp(2, 250)
  expect(s.onUndo).toHaveBeenCalledTimes(1)
  expect(s.controller.view.scale).toBe(2)
})

it.each([
  'long',
  'late join',
  'cancel',
  'replaced finger',
  'four fingers',
  'three-finger drag',
])('does not invoke history for %s', kind => {
  const s = surface()
  s.controller.touchDown(a, 0)
  s.controller.touchDown(b, kind === 'late join' ? 160 : 20)
  if (kind === 'cancel') s.controller.touchCancel(1)
  if (kind === 'replaced finger') {
    s.controller.touchUp(1, 60)
    s.controller.touchDown(c, 80)
  }
  if (kind === 'four fingers' || kind === 'three-finger drag')
    s.controller.touchDown(c, 30)
  if (kind === 'four fingers')
    s.controller.touchDown({id: 4, x: 100, y: 100}, 40)
  if (kind === 'three-finger drag') s.controller.touchMove({...c, y: 120})
  for (const id of [1, 2, 3, 4])
    s.controller.touchUp(id, kind === 'long' ? 500 : 250)
  expect(s.onUndo).not.toHaveBeenCalled()
  expect(s.onRedo).not.toHaveBeenCalled()
})

it('keeps gestures out of color controls and cancels cleanly on blur/termination', () => {
  const s = surface({gestures: false})
  s.controller.touchDown(a, 0)
  s.controller.touchDown(b, 10)
  s.controller.touchUp(1, 100)
  s.controller.touchUp(2, 110)
  expect(s.onUndo).not.toHaveBeenCalled()
  s.controller.start(100, 100)
  s.controller.cancelAll()
  expect(s.onCancel).toHaveBeenCalledTimes(2)
  s.controller.move(150, 150)
  expect(s.onMove).not.toHaveBeenCalled()
})

it('bounds focal wheel zoom, keyboard reveal, fit, and trackpad pan', () => {
  const s = surface()
  s.controller.zoomAt(2, {x: 128, y: 128})
  expect(s.controller.view).toEqual({scale: 2, x: -128, y: -128})
  s.controller.panBy(-10, -20)
  expect(s.controller.view).toEqual({scale: 2, x: -138, y: -148})
  s.controller.zoomAt(100, {x: 100, y: 100})
  expect(s.controller.view.scale).toBe(12)
  s.controller.zoomAt(0.0001, {x: 100, y: 100})
  expect(s.controller.view).toEqual({scale: 1, x: 0, y: 0})
  s.controller.reset()
  expect(s.controller.view).toEqual({scale: 1, x: 0, y: 0})
})
