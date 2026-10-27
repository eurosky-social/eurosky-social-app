import {i18n as globalI18n, setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {act, fireEvent, render, waitFor} from '@testing-library/react-native'

import * as Toast from '#/components/Toast'
import {GiveCandyButton} from './GiveCandyButton'

let mockCostume: {costumeNumber: number; post?: string} | null
let mockSeason = true
let mockSignedIn = true
let mockSenderDid = 'did:plc:sender'
const mockClient = {
  get assertDid() {
    return mockSenderDid
  },
}
const mockGive = jest.fn()
const mockHasGiven = jest.fn()
const mockSignin = jest.fn()
let queryClient: QueryClient
jest.mock('./candyRecords', () => ({
  giveProfileCandy: (...args: unknown[]) => mockGive(...args),
  hasGivenProfileCandy: (...args: unknown[]) => mockHasGiven(...args),
}))
jest.mock('./costumes/records', () => ({
  fetchCostumeRecord: () => Promise.resolve(mockCostume),
}))
jest.mock('#/state/session', () => ({
  usePdsClient: () => mockClient,
  useSession: () => ({
    currentAccount: mockSignedIn ? {did: mockSenderDid} : undefined,
  }),
  useRequireAuth: () => (fn: () => void) => {
    if (mockSignedIn) fn()
    else mockSignin()
  },
}))
jest.mock('#/logger', () => ({logger: {error: jest.fn()}}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
jest.mock('#/features/halloween/context', () => ({
  useHalloween: () => ({isHalloween: mockSeason, isActive: false}),
}))
jest.mock('./CandyIcon', () => ({CandyIcon: () => null}))
jest.mock('#/components/Button', () => {
  const {Pressable, Text} = require('react-native')
  return {Button: Pressable, ButtonText: Text, ButtonIcon: () => null}
})
const i18n = setupI18n({locale: 'en', messages: {en: {}}})
const element = (did = 'did:plc:alice') => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider i18n={i18n}>
      <GiveCandyButton did={did} />
    </I18nProvider>
  </QueryClientProvider>
)

beforeEach(() => {
  jest.clearAllMocks()
  globalI18n.loadAndActivate({locale: 'en', messages: {}})
  mockCostume = null
  mockSeason = true
  mockSignedIn = true
  mockSenderDid = 'did:plc:sender'
  mockHasGiven.mockReset()
  mockHasGiven.mockResolvedValue(false)
  mockGive.mockResolvedValue({uri: 'at://sender/social.mu.halloween.candy/new'})
  queryClient = new QueryClient({
    defaultOptions: {
      queries: {retry: false, gcTime: 0},
      mutations: {retry: false, gcTime: 0},
    },
  })
})
afterEach(() => queryClient.clear())

it('does not add a button to profiles without a costume record', async () => {
  const screen = render(element())
  await waitFor(() =>
    expect(
      queryClient.getQueryState(['halloweenCostume', 'did:plc:alice'])?.status,
    ).toBe('success'),
  )
  expect(screen.queryByTestId('profileGiveCandy')).toBeNull()
  expect(mockHasGiven).not.toHaveBeenCalled()
})

it.each([undefined, 'at://did:plc:alice/app.bsky.feed.post/3abc'])(
  'creates a direct candy gift with the theme off, with or without a costume post: %s',
  async post => {
    mockCostume = {costumeNumber: 3, post}
    const screen = render(element())
    await waitFor(() =>
      expect(screen.getByTestId('profileGiveCandy')).toBeEnabled(),
    )
    fireEvent.press(screen.getByTestId('profileGiveCandy'))
    await waitFor(() =>
      expect(mockGive).toHaveBeenCalledWith(mockClient, 'did:plc:alice'),
    )
    await waitFor(() => expect(Toast.show).toHaveBeenCalledWith('Candy given!'))
  },
)

it('hides the profile candy button outside the seasonal window, even with cached costume data', () => {
  mockSeason = false
  mockCostume = {costumeNumber: 3}
  expect(render(element()).queryByTestId('profileGiveCandy')).toBeNull()
})

it('does not offer candy on your own profile', async () => {
  mockCostume = {costumeNumber: 1}
  const screen = render(element(mockSenderDid))
  await act(async () => {
    await Promise.resolve()
  })
  expect(screen.queryByTestId('profileGiveCandy')).toBeNull()
  expect(mockHasGiven).not.toHaveBeenCalled()
  expect(mockGive).not.toHaveBeenCalled()
})

it('requires sign-in before writing a gift', async () => {
  mockSignedIn = false
  mockCostume = {costumeNumber: 1}
  const screen = render(element())
  await waitFor(() => expect(screen.getByText('Give candy')).toBeTruthy())
  fireEvent.press(screen.getByTestId('profileGiveCandy'))
  expect(mockSignin).toHaveBeenCalledTimes(1)
  expect(mockGive).not.toHaveBeenCalled()
  expect(mockHasGiven).not.toHaveBeenCalled()
})

it('disables the button while sending, then permits another deliberate gift', async () => {
  let finish!: (value: {uri: string}) => void
  mockGive.mockReturnValueOnce(
    new Promise(resolve => {
      finish = resolve
    }),
  )
  mockCostume = {costumeNumber: 1}
  const screen = render(element())
  await waitFor(() => expect(screen.getByText('Give candy')).toBeTruthy())
  fireEvent.press(screen.getByTestId('profileGiveCandy'))
  await waitFor(() =>
    expect(screen.getByTestId('profileGiveCandy')).toBeDisabled(),
  )
  fireEvent.press(screen.getByTestId('profileGiveCandy'))
  expect(mockGive).toHaveBeenCalledTimes(1)
  await act(async () => {
    finish({uri: 'first'})
    await Promise.resolve()
  })
  await waitFor(() =>
    expect(screen.getByTestId('profileGiveCandy')).toBeEnabled(),
  )
  expect(screen.getByText('Give more candy')).toBeTruthy()
  fireEvent.press(screen.getByTestId('profileGiveCandy'))
  await waitFor(() => expect(mockGive).toHaveBeenCalledTimes(2))
})

it('reports a failed write without retrying or showing success', async () => {
  mockGive.mockRejectedValueOnce(new Error('Gift rejected'))
  mockCostume = {costumeNumber: 1}
  const screen = render(element())
  await waitFor(() => expect(screen.getByText('Give candy')).toBeTruthy())
  fireEvent.press(screen.getByTestId('profileGiveCandy'))
  await waitFor(() =>
    expect(Toast.show).toHaveBeenCalledWith(
      'Could not give candy. Gift rejected',
      {type: 'error'},
    ),
  )
  expect(mockGive).toHaveBeenCalledTimes(1)
  expect(Toast.show).not.toHaveBeenCalledWith('Candy given!')
  expect(screen.queryByText('Give more candy')).toBeNull()
})

it('shows gifts from earlier visits and still permits giving more', async () => {
  mockCostume = {costumeNumber: 1}
  mockHasGiven.mockResolvedValue(true)
  const screen = render(element())
  await waitFor(() => expect(screen.getByText('Give more candy')).toBeTruthy())
  expect(mockHasGiven).toHaveBeenCalledWith(
    'did:plc:sender',
    'did:plc:alice',
    expect.anything(),
  )
  expect(screen.getByTestId('profileGiveCandy').props.color).toBe(
    'primary_subtle',
  )
  fireEvent.press(screen.getByTestId('profileGiveCandy'))
  await waitFor(() => expect(mockGive).toHaveBeenCalledTimes(1))
})

it('keeps confirmed gifts visible when an older index lookup finishes late', async () => {
  mockCostume = {costumeNumber: 1}
  let finishLookup!: (given: boolean) => void
  mockHasGiven.mockReturnValueOnce(
    new Promise(resolve => {
      finishLookup = resolve
    }),
  )
  const screen = render(element())
  await waitFor(() => expect(mockHasGiven).toHaveBeenCalledTimes(1))
  fireEvent.press(screen.getByTestId('profileGiveCandy'))
  await waitFor(() => expect(screen.getByText('Give more candy')).toBeTruthy())
  await act(async () => {
    finishLookup(false)
    await Promise.resolve()
  })
  expect(screen.getByText('Give more candy')).toBeTruthy()
  screen.unmount()
  const reopened = render(element())
  expect(reopened.getByText('Give more candy')).toBeTruthy()
})

it('keeps gift state separate for each sender and recipient', async () => {
  mockCostume = {costumeNumber: 1}
  mockHasGiven.mockImplementation((sender, subject) =>
    Promise.resolve(sender === 'did:plc:sender' && subject === 'did:plc:alice'),
  )
  const screen = render(element())
  await waitFor(() => expect(screen.getByText('Give more candy')).toBeTruthy())
  screen.rerender(element('did:plc:bob'))
  await waitFor(() => expect(screen.getByText('Give candy')).toBeTruthy())
  mockSenderDid = 'did:plc:other-sender'
  screen.rerender(element())
  await waitFor(() =>
    expect(mockHasGiven).toHaveBeenLastCalledWith(
      'did:plc:other-sender',
      'did:plc:alice',
      expect.anything(),
    ),
  )
  expect(screen.getByText('Give candy')).toBeTruthy()
})

it('allows giving candy when the index is unavailable', async () => {
  mockCostume = {costumeNumber: 1}
  mockHasGiven.mockRejectedValue(new Error('Index unavailable'))
  const screen = render(element())
  await waitFor(() => expect(mockHasGiven).toHaveBeenCalledTimes(1))
  fireEvent.press(screen.getByTestId('profileGiveCandy'))
  await waitFor(() => expect(screen.getByText('Give more candy')).toBeTruthy())
})
