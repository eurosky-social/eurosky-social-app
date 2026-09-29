import {act, renderHook} from '@testing-library/react-native'

import {account} from '#/storage'
import {Provider, useSelectedFeed, useSetSelectedFeed} from './selected-feed'

let mockDid: string | undefined
let mockIsWeb = true
jest.mock('#/state/session', () => ({
  useSession: () => ({currentAccount: mockDid ? {did: mockDid} : undefined}),
}))
jest.mock('#/env', () => ({
  get IS_WEB() {
    return mockIsWeb
  },
}))
jest.mock('#/storage', () => ({
  account: {get: jest.fn(), set: jest.fn()},
}))

const sessionValues = new Map<string, string>()
const getItem = jest.fn((key: string) => sessionValues.get(key) ?? null)
const setItem = jest.fn((key: string, value: string) => {
  sessionValues.set(key, value)
})

beforeEach(() => {
  jest.clearAllMocks()
  mockDid = 'did:plc:alice'
  mockIsWeb = true
  sessionValues.clear()
  getItem.mockImplementation(key => sessionValues.get(key) ?? null)
  jest.mocked(account.get).mockReturnValue(undefined)
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {pathname: '/', search: ''},
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {getItem, setItem},
  })
})

afterEach(() => jest.restoreAllMocks())

function renderSelection() {
  return renderHook(
    () => ({selected: useSelectedFeed(), select: useSetSelectedFeed()}),
    {wrapper: Provider},
  )
}

it('does not invent a local default or write storage during initialization', () => {
  const {result} = renderSelection()
  expect(result.current.selected).toBeNull()
  expect(account.set).not.toHaveBeenCalled()
  expect(setItem).not.toHaveBeenCalled()
  expect(account.get).toHaveBeenCalledTimes(1)
  expect(account.get).toHaveBeenCalledWith([mockDid, 'lastSelectedHomeFeed'])
})

it('prefers an explicit home deep link over remembered selections', () => {
  window.location.search = '?feed=following'
  sessionValues.set(`lastSelectedHomeFeed:${mockDid}`, 'feedgen|other')
  const {result} = renderSelection()
  expect(result.current.selected).toBe('following')
})

it('only reads the feed query parameter on the home route', () => {
  window.location.pathname = '/profile/example.test'
  window.location.search = '?feed=following'
  const {result} = renderSelection()
  expect(result.current.selected).toBeNull()
})

it('prefers the per-account tab selection over persistent account storage', () => {
  sessionValues.set(`lastSelectedHomeFeed:${mockDid}`, 'following')
  jest.mocked(account.get).mockReturnValue('feedgen|stored')
  const {result} = renderSelection()
  expect(result.current.selected).toBe('following')
})

it('falls back to persistent account storage', () => {
  jest.mocked(account.get).mockReturnValue('following')
  const {result} = renderSelection()
  expect(result.current.selected).toBe('following')
})

it('does not leak selections between accounts or use the old global tab key', () => {
  sessionValues.set('lastSelectedHomeFeed', 'feedgen|legacy')
  const alice = renderSelection()
  act(() => alice.result.current.select('following'))
  expect(sessionValues.get('lastSelectedHomeFeed:did:plc:alice')).toBe(
    'following',
  )
  expect(account.set).toHaveBeenCalledWith(
    ['did:plc:alice', 'lastSelectedHomeFeed'],
    'following',
  )
  alice.unmount()

  // App.tsx keys the provider tree by DID when switching accounts.
  mockDid = 'did:plc:bob'
  const bob = renderSelection()
  expect(bob.result.current.selected).toBeNull()
  bob.unmount()

  mockDid = 'did:plc:alice'
  expect(renderSelection().result.current.selected).toBe('following')
})

it('can fall back when sessionStorage is blocked', () => {
  getItem.mockImplementation(() => {
    throw new Error('Storage blocked')
  })
  jest.mocked(account.get).mockReturnValue('following')
  expect(renderSelection().result.current.selected).toBe('following')
})

it('does not read or write account selections when logged out', () => {
  mockDid = undefined
  const {result} = renderSelection()
  act(() => result.current.select('following'))
  expect(account.get).not.toHaveBeenCalled()
  expect(account.set).not.toHaveBeenCalled()
  expect(getItem).not.toHaveBeenCalled()
  expect(setItem).not.toHaveBeenCalled()
})

it('uses only account storage on native', () => {
  mockIsWeb = false
  jest.mocked(account.get).mockReturnValue('following')
  const {result} = renderSelection()
  expect(result.current.selected).toBe('following')
  act(() => result.current.select('feedgen|other'))
  expect(account.set).toHaveBeenCalledWith(
    [mockDid, 'lastSelectedHomeFeed'],
    'feedgen|other',
  )
  expect(getItem).not.toHaveBeenCalled()
  expect(setItem).not.toHaveBeenCalled()
})
