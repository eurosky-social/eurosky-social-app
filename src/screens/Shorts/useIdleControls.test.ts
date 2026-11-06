import {act, renderHook} from '@testing-library/react-native'

import {SHORTS_CONTROLS_IDLE_MS, useIdleControls} from './useIdleControls'

const originalDocument = global.document
let listeners: Map<string, () => void>
let menu = false
let keyboardFocus = false
beforeEach(() => {
  jest.useFakeTimers()
  menu = false
  keyboardFocus = false
  listeners = new Map()
  global.document = {
    querySelector: () => (menu ? {} : null),
    activeElement: {matches: () => keyboardFocus},
    addEventListener: (type: string, callback: () => void) =>
      listeners.set(type, callback),
    removeEventListener: (type: string) => listeners.delete(type),
  } as unknown as Document
})
afterEach(() => {
  jest.useRealTimers()
  global.document = originalDocument
})
it('hides all chrome after two seconds, restores on activity and resets for a new clip', () => {
  const {result, rerender, unmount} = renderHook(
    ({clip}: {clip: number}) => useIdleControls(true, clip),
    {initialProps: {clip: 0}},
  )
  expect(SHORTS_CONTROLS_IDLE_MS).toBe(2000)
  act(() => jest.advanceTimersByTime(2000))
  expect(result.current.visible).toBe(false)
  act(() => listeners.get('pointermove')?.())
  expect(result.current.visible).toBe(true)
  act(() => jest.advanceTimersByTime(2000))
  expect(result.current.visible).toBe(false)
  rerender({clip: 1})
  expect(result.current.visible).toBe(true)
  unmount()
  expect(jest.getTimerCount()).toBe(0)
  expect(listeners.size).toBe(0)
})
it('does not hide an open menu or keyboard-focused control', () => {
  const {result} = renderHook(() => useIdleControls(true, 0))
  menu = true
  act(() => jest.advanceTimersByTime(4000))
  expect(result.current.visible).toBe(true)
  menu = false
  keyboardFocus = true
  act(() => listeners.get('keydown')?.())
  act(() => jest.advanceTimersByTime(4000))
  expect(result.current.visible).toBe(true)
  keyboardFocus = false
  act(() => jest.advanceTimersByTime(2000))
  expect(result.current.visible).toBe(false)
})
it('keeps controls available when playback is unavailable and clears timers on blur', () => {
  const {result, rerender} = renderHook(
    ({enabled}: {enabled: boolean}) => useIdleControls(enabled, 0),
    {initialProps: {enabled: true}},
  )
  act(() => jest.advanceTimersByTime(2000))
  rerender({enabled: false})
  expect(result.current.visible).toBe(true)
  expect(jest.getTimerCount()).toBe(0)
})
