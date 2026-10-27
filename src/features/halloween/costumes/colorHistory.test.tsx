import {act, renderHook} from '@testing-library/react-native'

import * as persisted from '#/state/persisted'
import {ColorHistoryProvider, useColorHistory} from './colorHistory'

jest.mock('#/state/persisted', () => ({
  get: jest.fn(),
  readLatest: jest.fn(),
  write: jest.fn(),
  onUpdate: jest.fn(),
}))
let stored: Record<string, string[]> | undefined
let update: (value: Record<string, string[]> | undefined) => void
const unsubscribe = jest.fn()
beforeEach(() => {
  jest.clearAllMocks()
  stored = undefined
  jest.mocked(persisted.get).mockImplementation(() => stored)
  jest.mocked(persisted.readLatest).mockImplementation(() => stored)
  jest.mocked(persisted.write).mockImplementation((_key, value) => {
    stored = value as typeof stored
    return Promise.resolve()
  })
  jest.mocked(persisted.onUpdate).mockImplementation((_key, callback) => {
    update = callback
    return unsubscribe
  })
})

it('keeps a bounded, unique MRU list per DID and preserves fresh cross-tab data', () => {
  const screen = renderHook(useColorHistory, {wrapper: ColorHistoryProvider})
  act(() => screen.result.current.used('did:plc:alice', '#abc123'))
  stored = {...stored, 'did:plc:bob': ['#FFFFFF']}
  act(() => screen.result.current.used('did:plc:alice', '#123456'))
  act(() => screen.result.current.used('did:plc:alice', '#ABC123'))
  expect(screen.result.current.colors['did:plc:alice']).toEqual([
    '#ABC123',
    '#123456',
  ])
  expect(screen.result.current.colors['did:plc:bob']).toEqual(['#FFFFFF'])
  const writes = jest.mocked(persisted.write).mock.calls.length
  act(() => screen.result.current.used('did:plc:alice', '#ABC123'))
  expect(persisted.write).toHaveBeenCalledTimes(writes)
  act(() => {
    for (let i = 0; i < 30; i++)
      screen.result.current.used(
        'did:plc:alice',
        `#${i.toString(16).padStart(6, '0')}`,
      )
  })
  expect(screen.result.current.colors['did:plc:alice']).toHaveLength(24)
})

it('survives remount, follows other tabs, and rejects corrupt preference data', () => {
  const first = renderHook(useColorHistory, {wrapper: ColorHistoryProvider})
  act(() => first.result.current.used('did:plc:alice', '#123456'))
  first.unmount()
  const next = renderHook(useColorHistory, {wrapper: ColorHistoryProvider})
  expect(next.result.current.colors['did:plc:alice']).toEqual(['#123456'])
  act(() => update({'did:plc:alice': ['not a color']}))
  expect(next.result.current.colors).toEqual({})
  act(() => next.result.current.used('did:plc:alice', 'invalid'))
  expect(persisted.write).toHaveBeenCalledTimes(1)
  next.unmount()
  expect(unsubscribe).toHaveBeenCalledTimes(2)
})
