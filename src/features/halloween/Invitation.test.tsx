import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {act, fireEvent, render} from '@testing-library/react-native'

import {HalloweenInvitation} from './Invitation'

const mockNavigate = jest.fn()
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}))
const mockOpen = jest.fn()
const mockClose = jest.fn<void, [(() => void)?]>()
const mockControl = {open: mockOpen, close: mockClose}
const mockHalloween = {
  shouldPrompt: true,
  shouldPromptCostume: true,
  setEnabled: jest.fn(),
  dismissInvitation: jest.fn(),
  dismissCostumeInvitation: jest.fn(),
}
const mockOpenDialogs = {current: new Set<string>()}
let mockCanOpen = true
let mockPolicyCompleted = true
let mockAppState = 'active'
let mockDialogOnClose: () => void

jest.mock('#/features/halloween/context', () => ({
  useHalloween: () => mockHalloween,
}))
jest.mock('#/state/dialogs', () => ({
  useDialogStateContext: () => ({openDialogs: mockOpenDialogs}),
}))
jest.mock('#/lib/appState', () => ({
  getCurrentState: () => mockAppState,
}))
jest.mock('#/components/PolicyUpdateOverlay', () => ({
  usePolicyUpdateContext: () => ({state: {completed: mockPolicyCompleted}}),
}))
jest.mock('#/alf', () => ({
  atoms: {},
  useTheme: () => ({atoms: {}}),
}))
jest.mock('#/components/Typography', () => ({
  Text: jest.requireActual<typeof import('react-native')>('react-native').Text,
}))
jest.mock('#/components/Button', () => {
  const {Pressable, Text} = require('react-native')
  return {Button: Pressable, ButtonText: Text}
})
jest.mock('#/components/Dialog', () => {
  const {View} = require('react-native')
  return {
    useDialogControl: () => mockControl,
    Outer: ({
      children,
      onClose,
    }: React.PropsWithChildren<{onClose: () => void}>) => {
      mockDialogOnClose = onClose
      return <View>{children}</View>
    },
    ScrollableInner: View,
    Handle: () => null,
    Close: () => null,
  }
})

const i18n = setupI18n({locale: 'en', messages: {en: {}}})

function renderInvitation(kind: 'theme' | 'costume' = 'theme') {
  const onOpen = jest.fn()
  const onClose = jest.fn()
  const element = () => (
    <I18nProvider i18n={i18n}>
      <HalloweenInvitation
        kind={kind}
        canOpen={mockCanOpen}
        onOpen={onOpen}
        onClose={onClose}
      />
    </I18nProvider>
  )
  const screen = render(element())
  return {...screen, onOpen, onClose, refresh: () => screen.rerender(element())}
}

beforeEach(() => {
  jest.useFakeTimers()
  jest.clearAllMocks()
  mockHalloween.shouldPrompt = true
  mockHalloween.shouldPromptCostume = true
  mockCanOpen = true
  mockOpenDialogs.current.clear()
  mockPolicyCompleted = true
  mockAppState = 'active'
})

afterEach(() => jest.useRealTimers())

it('offers opt-in without enabling the theme merely by opening', () => {
  renderInvitation()
  act(() => jest.advanceTimersByTime(500))
  expect(mockOpen).toHaveBeenCalledTimes(1)
  expect(mockHalloween.setEnabled).not.toHaveBeenCalled()
})

it('waits for the active NUX and reports opening before another can be queued', () => {
  mockCanOpen = false
  const screen = renderInvitation()
  act(() => jest.advanceTimersByTime(1000))
  expect(mockOpen).not.toHaveBeenCalled()
  mockCanOpen = true
  screen.refresh()
  act(() => jest.advanceTimersByTime(500))
  expect(screen.onOpen).toHaveBeenCalledTimes(1)
  expect(mockOpen).toHaveBeenCalledTimes(1)
  mockHalloween.shouldPrompt = false
  screen.refresh()
  expect(screen.onClose).not.toHaveBeenCalled()
  act(() => mockDialogOnClose())
  expect(screen.onClose).toHaveBeenCalledTimes(1)
})

it('waits for other dialogs to close before inviting', () => {
  mockOpenDialogs.current.add('another-dialog')
  renderInvitation()
  act(() => jest.advanceTimersByTime(1500))
  expect(mockOpen).not.toHaveBeenCalled()
  mockOpenDialogs.current.clear()
  act(() => jest.advanceTimersByTime(500))
  expect(mockOpen).toHaveBeenCalledTimes(1)
})

it('waits for policy completion and foreground state', () => {
  mockPolicyCompleted = false
  const screen = renderInvitation()
  act(() => jest.advanceTimersByTime(1000))
  expect(mockOpen).not.toHaveBeenCalled()
  mockPolicyCompleted = true
  mockAppState = 'background'
  screen.refresh()
  act(() => jest.advanceTimersByTime(1000))
  expect(mockOpen).not.toHaveBeenCalled()
  mockAppState = 'active'
  act(() => jest.advanceTimersByTime(500))
  expect(mockOpen).toHaveBeenCalledTimes(1)
})

it('enables only after the close-animation callback on acceptance', () => {
  const screen = renderInvitation()
  act(() => jest.advanceTimersByTime(500))
  fireEvent.press(screen.getByTestId('enableHalloweenMode'))
  expect(mockClose).toHaveBeenCalledTimes(1)
  expect(mockHalloween.setEnabled).not.toHaveBeenCalled()
  act(() => mockClose.mock.calls[0][0]?.())
  expect(mockHalloween.setEnabled).toHaveBeenCalledWith(true)
})

it('declines without enabling and acknowledges all dismissal paths on close', () => {
  const screen = renderInvitation()
  act(() => jest.advanceTimersByTime(500))
  fireEvent.press(screen.getByTestId('dismissHalloweenMode'))
  expect(mockClose).toHaveBeenCalledWith(expect.any(Function))
  act(() => mockDialogOnClose())
  act(() => mockClose.mock.calls[0][0]?.())
  expect(mockHalloween.dismissInvitation).toHaveBeenCalledTimes(1)
  expect(screen.onClose).toHaveBeenCalledTimes(1)
  expect(mockHalloween.setEnabled).toHaveBeenCalledWith(false)
  expect(mockHalloween.dismissCostumeInvitation).not.toHaveBeenCalled()
})

it('closes an open invitation when the date expires or another tab decides', () => {
  const screen = renderInvitation()
  act(() => jest.advanceTimersByTime(500))
  mockHalloween.shouldPrompt = false
  screen.refresh()
  expect(mockClose).toHaveBeenCalledWith()
})

it('offers costumes after the theme decision, and only navigates after closing', () => {
  const screen = renderInvitation('costume')
  act(() => jest.advanceTimersByTime(1000))
  expect(mockOpen).not.toHaveBeenCalled()
  mockHalloween.shouldPrompt = false
  screen.refresh()
  act(() => jest.advanceTimersByTime(500))
  expect(mockOpen).toHaveBeenCalledTimes(1)
  fireEvent.press(screen.getByTestId('createHalloweenCostume'))
  expect(mockNavigate).not.toHaveBeenCalled()
  act(() => mockDialogOnClose())
  expect(mockHalloween.dismissCostumeInvitation).toHaveBeenCalledTimes(1)
  expect(mockHalloween.dismissInvitation).not.toHaveBeenCalled()
  act(() => mockClose.mock.calls[0][0]?.())
  expect(mockNavigate).toHaveBeenCalledWith('CostumeEditor')
  expect(mockHalloween.setEnabled).not.toHaveBeenCalled()
})

it('dismisses the costume offer without changing theme consent or navigating', () => {
  mockHalloween.shouldPrompt = false
  const screen = renderInvitation('costume')
  act(() => jest.advanceTimersByTime(500))
  fireEvent.press(screen.getByTestId('dismissHalloweenCostume'))
  act(() => mockDialogOnClose())
  act(() => mockClose.mock.calls[0][0]?.())
  expect(mockHalloween.dismissCostumeInvitation).toHaveBeenCalledTimes(1)
  expect(mockHalloween.setEnabled).not.toHaveBeenCalled()
  expect(mockNavigate).not.toHaveBeenCalled()
})

it('does not open outside the invitation window and cancels pending work', () => {
  mockHalloween.shouldPrompt = false
  const screen = renderInvitation()
  act(() => jest.advanceTimersByTime(1000))
  expect(mockOpen).not.toHaveBeenCalled()
  mockHalloween.shouldPrompt = true
  screen.refresh()
  screen.unmount()
  act(() => jest.advanceTimersByTime(1000))
  expect(mockOpen).not.toHaveBeenCalled()
})
