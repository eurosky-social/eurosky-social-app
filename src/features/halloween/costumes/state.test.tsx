import {act, renderHook} from '@testing-library/react-native'

import * as persisted from '#/state/persisted'
import {type Costume, createCostume} from './model'
import {CostumesProvider, useCostumes} from './state'

jest.mock('#/features/halloween/costumes/colorHistory', () => ({
  ColorHistoryProvider: ({children}: React.PropsWithChildren<{}>) => children,
}))
jest.mock('#/state/persisted', () => ({
  get: jest.fn(),
  readLatest: jest.fn(),
  write: jest.fn(),
  onUpdate: jest.fn(),
}))

let stored: Record<string, Costume> | undefined
let onUpdate: (next: Record<string, Costume> | undefined) => void
const unsubscribe = jest.fn()
const alice = 'did:plc:alice'
const bob = 'did:plc:bob'
const art = (ink = 2) => ({
  ...createCostume(),
  pixels: createCostume().pixels.map((pixel, index) =>
    index === 0 ? ink : pixel,
  ),
})

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
    onUpdate = callback
    return unsubscribe
  })
})

function renderCostumes() {
  return renderHook(useCostumes, {wrapper: CostumesProvider})
}

it('saves per DID, survives remount, and preserves other accounts and fresh cross-tab data', async () => {
  const first = renderCostumes()
  await act(() => first.result.current.saveCostume(alice, art()))
  expect(first.result.current.costumes[alice].pixels[0]).toBe(2)
  expect(persisted.write).toHaveBeenCalledWith(
    'halloweenCostumes',
    expect.any(Object),
  )
  stored = {...stored, [bob]: art()}
  await act(() => first.result.current.saveCostume(alice, art(1)))
  expect(stored?.[bob]).toBeDefined()
  first.unmount()
  const second = renderCostumes()
  expect(second.result.current.costumes[alice].pixels[0]).toBe(1)
  expect(second.result.current.costumes[bob].pixels[0]).toBe(2)
})

it('clearing and saving removes only that account’s costume', async () => {
  stored = {[alice]: art(), [bob]: art()}
  const {result} = renderCostumes()
  await act(() => result.current.saveCostume(alice, createCostume()))
  expect(result.current.costumes[alice]).toBeUndefined()
  expect(result.current.costumes[bob]).toBeDefined()
  await act(() => result.current.saveCostume(bob, null))
  expect(result.current.costumes).toEqual({})
})

it('reacts to cross-tab updates and unsubscribes', () => {
  const screen = renderCostumes()
  act(() => onUpdate({[alice]: art()}))
  expect(screen.result.current.costumes[alice]).toBeDefined()
  act(() => onUpdate(undefined))
  expect(screen.result.current.costumes).toEqual({})
  screen.unmount()
  expect(unsubscribe).toHaveBeenCalledTimes(1)
})

it('rejects malformed writes without changing saved art', async () => {
  const {result} = renderCostumes()
  await expect(
    result.current.saveCostume(alice, {...art(), pixels: []}),
  ).rejects.toThrow()
  await expect(result.current.saveCostume('', art())).rejects.toThrow()
  expect(persisted.write).not.toHaveBeenCalled()
  expect(result.current.costumes).toEqual({})
})
