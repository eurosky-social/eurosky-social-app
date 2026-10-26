import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {act, fireEvent, render, waitFor} from '@testing-library/react-native'

import {FU_FEED_URI, FU_SAVED_FEED} from '#/lib/constants'
import {preferencesQueryKey} from '#/state/queries/preferences'
import {type EnabledCheckProps} from '#/components/dialogs/nuxs/utils'
import {enabled, MuForYouFeedAnnouncement} from './index'
import {pinMuForYouFeed} from './preferences'

const mockClose = jest.fn<void, [(() => void)?]>()
const mockDismiss = jest.fn()
const mockSelect = jest.fn()
const mockClient = {}
const mockControl = {close: mockClose}
let mockIsE2E = false

jest.mock('#/env', () => ({
  get IS_E2E() {
    return mockIsE2E
  },
}))
jest.mock('#/state/session', () => ({usePdsClient: () => mockClient}))
jest.mock('#/state/queries/preferences', () => ({
  preferencesQueryKey: ['preferences'],
}))
jest.mock('#/state/shell/selected-feed', () => ({
  useSetSelectedFeed: () => mockSelect,
}))
jest.mock('#/components/dialogs/nuxs', () => ({
  useNuxDialogContext: () => ({dismissActiveNux: mockDismiss}),
}))
jest.mock('#/alf', () => ({
  atoms: {},
  useTheme: () => ({atoms: {}, palette: {negative_500: 'red'}}),
  web: (style: object) => style,
}))
jest.mock('#/components/Typography', () => ({
  Text: jest.requireActual<typeof import('react-native')>('react-native').Text,
}))
jest.mock('#/components/Button', () => {
  const {Pressable, Text} = require('react-native')
  return {Button: Pressable, ButtonText: Text, ButtonIcon: () => null}
})
jest.mock('#/components/Loader', () => ({Loader: () => null}))
jest.mock('#/components/Dialog', () => {
  const {View} = require('react-native')
  return {
    useDialogControl: () => mockControl,
    useAutoOpen: () => {},
    Outer: View,
    ScrollableInner: View,
    Handle: () => null,
    Close: () => null,
  }
})
jest.mock('./preferences', () => ({
  ...jest.requireActual('./preferences'),
  pinMuForYouFeed: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
  mockIsE2E = false
  jest.mocked(pinMuForYouFeed).mockResolvedValue(undefined)
})

function renderAnnouncement() {
  const client = new QueryClient({
    defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
  })
  const invalidate = jest.spyOn(client, 'invalidateQueries')
  const i18n = setupI18n({locale: 'en', messages: {en: {}}})
  const screen = render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MuForYouFeedAnnouncement />
      </QueryClientProvider>
    </I18nProvider>,
  )
  return {...screen, invalidate}
}

describe('announcement eligibility', () => {
  it.each([
    [[], true],
    [[{...FU_SAVED_FEED, id: 'mu', pinned: false}], true],
    [[{...FU_SAVED_FEED, id: 'mu'}], false],
  ])(
    'only offers the feed when it is not already pinned (%j)',
    (savedFeeds, expected) => {
      expect(enabled({preferences: {savedFeeds}} as EnabledCheckProps)).toBe(
        expected,
      )
    },
  )

  it('does not interrupt E2E flows', () => {
    mockIsE2E = true
    expect(
      enabled({preferences: {savedFeeds: []}} as unknown as EnabledCheckProps),
    ).toBe(false)
  })
})

it('does not change saved feeds or selection on display or decline', () => {
  const {getByTestId} = renderAnnouncement()
  expect(pinMuForYouFeed).not.toHaveBeenCalled()
  fireEvent.press(getByTestId('muForYouFeedDismiss'))
  expect(mockClose).toHaveBeenCalledWith()
  expect(pinMuForYouFeed).not.toHaveBeenCalled()
  expect(mockSelect).not.toHaveBeenCalled()
})

it('persists acceptance, refreshes preferences, then selects the feed after closing', async () => {
  const {getByTestId, invalidate} = renderAnnouncement()
  fireEvent.press(getByTestId('muForYouFeedAdd'))
  await waitFor(() => expect(mockClose).toHaveBeenCalledTimes(1))
  expect(pinMuForYouFeed).toHaveBeenCalledWith(mockClient)
  expect(invalidate).toHaveBeenCalledWith({queryKey: preferencesQueryKey})
  expect(mockSelect).not.toHaveBeenCalled()
  act(() => {
    mockClose.mock.calls[0][0]?.()
  })
  expect(mockSelect).toHaveBeenCalledWith(`feedgen|${FU_FEED_URI}`)
})

it('shows an error and allows retry without closing or selecting an unsaved feed', async () => {
  jest.mocked(pinMuForYouFeed).mockRejectedValueOnce(new Error('offline'))
  const {getByTestId, findByText} = renderAnnouncement()
  fireEvent.press(getByTestId('muForYouFeedAdd'))
  await findByText('Could not add the feed. Please try again.')
  expect(mockClose).not.toHaveBeenCalled()
  expect(mockSelect).not.toHaveBeenCalled()
  fireEvent.press(getByTestId('muForYouFeedAdd'))
  await waitFor(() => expect(mockClose).toHaveBeenCalledTimes(1))
  expect(pinMuForYouFeed).toHaveBeenCalledTimes(2)
})
