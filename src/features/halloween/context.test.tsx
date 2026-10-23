import {act, renderHook} from '@testing-library/react-native'

import {onAppStateChange} from '#/lib/appState'
import * as persisted from '#/state/persisted'
import {HalloweenProvider, useHalloween} from './context'

jest.mock('#/state/persisted', () => ({
  get: jest.fn(),
  readLatest: jest.fn(),
  write: jest.fn(),
  onUpdate: jest.fn(),
}))
jest.mock('#/lib/appState', () => ({onAppStateChange: jest.fn()}))

type Preference = persisted.Schema['halloween']
let stored: Preference
let broadcast: (next: Preference) => void
let resume: Parameters<typeof onAppStateChange>[0]
const remove = jest.fn()
const unsubscribe = jest.fn()

function renderHalloween() {
  return renderHook(useHalloween, {wrapper: HalloweenProvider})
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(new Date(2026, 9, 31, 12))
  jest.clearAllMocks()
  stored = {enabled: false}
  jest.mocked(persisted.get).mockImplementation(() => stored)
  jest.mocked(persisted.readLatest).mockImplementation(() => stored)
  jest.mocked(persisted.write).mockImplementation((_key, value) => {
    stored = value as Preference
    return Promise.resolve()
  })
  jest.mocked(persisted.onUpdate).mockImplementation((_key, callback) => {
    broadcast = callback
    return unsubscribe
  })
  jest.mocked(onAppStateChange).mockImplementation(callback => {
    resume = callback
    return {remove}
  })
})

afterEach(() => jest.useRealTimers())

it('defaults old installs without a preference to opt-out', () => {
  stored = undefined
  const {result} = renderHalloween()
  expect(result.current.isActive).toBe(false)
  expect(result.current.shouldPrompt).toBe(true)
})

it('saves explicit consent without touching other appearance settings', () => {
  const {result} = renderHalloween()
  act(() => result.current.setEnabled(true))
  expect(result.current.isActive).toBe(true)
  expect(result.current.shouldPrompt).toBe(false)
  expect(persisted.write).toHaveBeenCalledWith('halloween', {
    enabled: true,
    promptedYear: 2026,
  })
  act(() => result.current.setEnabled(false))
  expect(result.current.isActive).toBe(false)
  expect(result.current.shouldPrompt).toBe(false)
  expect(persisted.write).toHaveBeenCalledTimes(2)
})

it('remembers a declined or dismissed invitation after remount', () => {
  const first = renderHalloween()
  act(() => first.result.current.dismissInvitation())
  first.unmount()
  const {result} = renderHalloween()
  expect(result.current.enabled).toBe(false)
  expect(result.current.shouldPrompt).toBe(false)
})

it.each([28, 29, 30, 31])('offers opt-in on October %s', day => {
  jest.setSystemTime(new Date(2026, 9, day, 12))
  const {result} = renderHalloween()
  expect(result.current.isHalloween).toBe(true)
  expect(result.current.shouldPrompt).toBe(true)
  expect(result.current.isActive).toBe(false)
})

it('does not repeat a dismissed invitation on later event days', () => {
  jest.setSystemTime(new Date(2026, 9, 28, 12))
  const first = renderHalloween()
  act(() => first.result.current.dismissInvitation())
  first.unmount()
  for (const day of [29, 30, 31]) {
    jest.setSystemTime(new Date(2026, 9, day, 12))
    const screen = renderHalloween()
    expect(screen.result.current.shouldPrompt).toBe(false)
    screen.unmount()
  }
})

it('activates at local midnight on October 28 without a reload', () => {
  stored = {enabled: true}
  jest.setSystemTime(new Date(2026, 9, 27, 23, 59, 59))
  const {result} = renderHalloween()
  expect(result.current.isActive).toBe(false)
  act(() => jest.advanceTimersByTime(1000))
  expect(result.current.isActive).toBe(true)
})

it.each([28, 29, 30, 31])(
  'stays active across midnight after October %s',
  day => {
    stored = {enabled: true, promptedYear: 2026}
    jest.setSystemTime(new Date(2026, 9, day, 23, 59, 59))
    const {result} = renderHalloween()
    act(() => jest.advanceTimersByTime(1000))
    expect(result.current.isActive).toBe(true)
    expect(result.current.shouldPrompt).toBe(false)
    expect(persisted.write).not.toHaveBeenCalled()
  },
)

it('ends at local midnight on November 4 without overwriting consent', () => {
  stored = {enabled: true}
  jest.setSystemTime(new Date(2026, 10, 3, 23, 59, 59))
  const {result} = renderHalloween()
  expect(result.current.isActive).toBe(true)
  act(() => jest.advanceTimersByTime(1000))
  expect(result.current.isActive).toBe(false)
  expect(result.current.enabled).toBe(true)
  expect(persisted.write).not.toHaveBeenCalled()
})

it('rechecks immediately after native resume or web visibility changes', () => {
  stored = {enabled: true}
  const {result} = renderHalloween()
  jest.setSystemTime(new Date(2026, 10, 4, 9))
  act(() => resume('active'))
  expect(result.current.isActive).toBe(false)
})

it('picks up wall-clock or timezone changes while foregrounded', () => {
  stored = {enabled: true}
  const {result} = renderHalloween()
  jest.setSystemTime(new Date(2026, 10, 4, 9))
  act(() => jest.advanceTimersByTime(60_000))
  expect(result.current.isActive).toBe(false)
})

it('follows cross-tab preference updates', () => {
  const {result} = renderHalloween()
  act(() => broadcast({enabled: true, promptedYear: 2026}))
  expect(result.current.isActive).toBe(true)
  act(() => broadcast(undefined))
  expect(result.current.isActive).toBe(false)
})

it("preserves another tab's opt-in when dismissing the invitation", () => {
  const {result} = renderHalloween()
  stored = {enabled: true}
  act(() => result.current.dismissInvitation())
  expect(result.current.isActive).toBe(true)
})

it('can save an opt-in before October 28 without activating early', () => {
  jest.setSystemTime(new Date(2026, 9, 15))
  const {result} = renderHalloween()
  act(() => result.current.setEnabled(true))
  expect(result.current.enabled).toBe(true)
  expect(result.current.isActive).toBe(false)
  expect(result.current.shouldPrompt).toBe(false)
})

it.each([1, 2, 3])('offers both independent choices on November %s', day => {
  jest.setSystemTime(new Date(2026, 10, day, 12))
  const {result} = renderHalloween()
  expect(result.current.isHalloween).toBe(true)
  expect(result.current.shouldPrompt).toBe(true)
  expect(result.current.shouldPromptCostume).toBe(true)
})

it('remembers the costume choice separately without enabling the theme', () => {
  const first = renderHalloween()
  act(() => first.result.current.setEnabled(false))
  expect(first.result.current.shouldPromptCostume).toBe(true)
  act(() => first.result.current.dismissCostumeInvitation())
  expect(first.result.current.isActive).toBe(false)
  expect(stored).toEqual({
    enabled: false,
    promptedYear: 2026,
    costumePromptedYear: 2026,
  })
  first.unmount()
  const {result} = renderHalloween()
  expect(result.current.shouldPrompt).toBe(false)
  expect(result.current.shouldPromptCostume).toBe(false)
})

it('preserves a separate costume dismissal when the theme setting changes across tabs', () => {
  const {result} = renderHalloween()
  stored = {enabled: false, costumePromptedYear: 2026}
  act(() => result.current.setEnabled(true))
  expect(result.current.shouldPromptCostume).toBe(false)
  expect(stored?.costumePromptedYear).toBe(2026)
})

it('cleans up timers and listeners on unmount', () => {
  const {unmount} = renderHalloween()
  unmount()
  expect(jest.getTimerCount()).toBe(0)
  expect(remove).toHaveBeenCalled()
  expect(unsubscribe).toHaveBeenCalled()
})
