import {Keyboard} from 'react-native'
import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {type NavigationAction} from '@react-navigation/native'
import {act, fireEvent, render} from '@testing-library/react-native'

import {type Costume} from '#/features/halloween/costumes/model'
import {type useDrawing} from '#/features/halloween/costumes/useDrawing'
import {CostumeEditorScreen} from './index'

const mockSave = jest.fn<Promise<void>, [string, Costume | null]>()
const mockNavigation = {
  canGoBack: () => true,
  goBack: jest.fn(),
  navigate: jest.fn(),
  dispatch: jest.fn(),
}
const mockDrawer = jest.fn()
let mockDid = 'did:plc:alice'
let mockCostumes: Record<string, Costume> = {}
let mockPrevented = false
let mockPreventCallback: (event: {data: {action: NavigationAction}}) => void

jest.mock('#/state/session', () => ({
  useSession: () => ({currentAccount: {did: mockDid}}),
}))
jest.mock('#/state/queries/useCurrentAccountProfile', () => ({
  useCurrentAccountProfile: () => ({did: mockDid}),
}))
jest.mock('#/state/shell', () => ({
  useSetDrawerSwipeDisabled: () => mockDrawer,
}))
jest.mock('#/features/halloween/costumes/state', () => ({
  useCostumes: () => ({costumes: mockCostumes, saveCostume: mockSave}),
}))
jest.mock('#/alf', () => ({
  atoms: {},
  useTheme: () => ({atoms: {}, palette: {contrast_25: '#111111'}}),
  web: () => undefined,
}))
jest.mock('#/env', () => ({IS_WEB: false, IS_IOS: true}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({bottom: 0}),
}))
jest.mock('#/view/com/util/UserAvatar', () => ({UserAvatar: () => null}))
jest.mock('#/features/halloween/costumes/colorHistory', () => ({
  useColorHistory: () => ({colors: {}, used: jest.fn()}),
}))
jest.mock('#/features/halloween/costumes/photoPixels/usePhotoSampler', () => ({
  usePhotoSampler: () => () => null,
}))
jest.mock('#/features/halloween/costumes/PixelLayer', () => ({
  PixelLayer: () => null,
}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
jest.mock('#/components/Button', () => {
  const {Pressable, Text} = require('react-native')
  return {Button: Pressable, ButtonText: Text}
})
jest.mock('#/components/Layout', () => {
  const {View, Text} = require('react-native')
  return {
    Screen: View,
    Center: View,
    Header: {
      Outer: View,
      Content: View,
      TitleText: Text,
      BackButton: () => null,
    },
  }
})
jest.mock('@react-navigation/native', () => {
  const React = require('react') as typeof import('react')
  return {
    useIsFocused: () => true,
    useFocusEffect: (effect: () => () => void) =>
      React.useEffect(effect, [effect]),
    usePreventRemove: (
      prevented: boolean,
      callback: typeof mockPreventCallback,
    ) => {
      mockPrevented = prevented
      mockPreventCallback = callback
    },
  }
})
jest.mock('#/components/Prompt', () => {
  const {Pressable, Text} = require('react-native')
  return {
    usePromptControl: () => ({open: jest.fn()}),
    Basic: ({title, onConfirm}: {title: string; onConfirm: () => void}) => (
      <Pressable accessibilityRole="button" testID={title} onPress={onConfirm}>
        <Text>{title}</Text>
      </Pressable>
    ),
  }
})
jest.mock('#/features/halloween/costumes/Workspace', () => {
  const {Pressable, View} = require('react-native')
  return {
    CostumeWorkspace: ({
      drawing,
      onClear,
    }: {
      drawing: ReturnType<typeof useDrawing>
      onClear: () => void
    }) => (
      <View>
        <Pressable
          accessibilityRole="button"
          testID="paint"
          onPress={() => {
            drawing.start({x: 32, y: 32})
            drawing.end()
          }}
        />
        <Pressable
          accessibilityRole="button"
          testID="requestClear"
          onPress={onClear}
        />
      </View>
    ),
  }
})
const i18n = setupI18n({locale: 'en', messages: {en: {}}})

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(Keyboard, 'addListener').mockReturnValue({remove: jest.fn()})
  mockDid = 'did:plc:alice'
  mockCostumes = {}
  mockPrevented = false
  mockSave.mockResolvedValue()
})

function element() {
  return (
    <I18nProvider i18n={i18n}>
      <CostumeEditorScreen
        navigation={
          mockNavigation as unknown as React.ComponentProps<
            typeof CostumeEditorScreen
          >['navigation']
        }
        route={{key: 'costume', name: 'CostumeEditor'}}
      />
    </I18nProvider>
  )
}

it('keeps drafts local, guards unsaved changes, and saves the current DID before leaving', async () => {
  const screen = render(element())
  expect(mockDrawer).toHaveBeenCalledWith(true)
  expect(mockPrevented).toBe(false)
  fireEvent.press(screen.getByTestId('paint'))
  expect(mockPrevented).toBe(true)
  expect(mockSave).not.toHaveBeenCalled()
  await act(async () => {
    fireEvent.press(screen.getByTestId('costumeSave'))
    await Promise.resolve()
  })
  expect(mockSave).toHaveBeenCalledWith(
    'did:plc:alice',
    expect.objectContaining({version: 2, gridSize: 64}),
  )
  expect(mockPrevented).toBe(false)
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1)
  screen.unmount()
  expect(mockDrawer).toHaveBeenLastCalledWith(false)
})

it('resumes a blocked navigation only after discard is confirmed', () => {
  const screen = render(element())
  fireEvent.press(screen.getByTestId('paint'))
  const action = {type: 'NAVIGATE', payload: {name: 'Settings'}}
  act(() => mockPreventCallback({data: {action}}))
  expect(mockNavigation.dispatch).not.toHaveBeenCalled()
  fireEvent.press(screen.getByTestId('Discard your costume changes?'))
  expect(mockNavigation.dispatch).toHaveBeenCalledWith(action)
  expect(mockSave).not.toHaveBeenCalled()
})

it('does not resume a canceled destination when saving later', async () => {
  const screen = render(element())
  fireEvent.press(screen.getByTestId('paint'))
  act(() => mockPreventCallback({data: {action: {type: 'NAVIGATE'}}}))
  await act(async () => {
    fireEvent.press(screen.getByTestId('costumeSave'))
    await Promise.resolve()
  })
  expect(mockNavigation.dispatch).not.toHaveBeenCalled()
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1)
})

it('keeps a failed save editable and never carries a draft into a switched account', async () => {
  mockSave.mockRejectedValueOnce(new Error('Storage failed'))
  const screen = render(element())
  fireEvent.press(screen.getByTestId('paint'))
  await act(async () => {
    fireEvent.press(screen.getByTestId('costumeSave'))
    await Promise.resolve()
  })
  expect(mockNavigation.goBack).not.toHaveBeenCalled()
  expect(mockPrevented).toBe(true)
  mockDid = 'did:plc:bob'
  screen.rerender(element())
  expect(mockPrevented).toBe(false)
})
