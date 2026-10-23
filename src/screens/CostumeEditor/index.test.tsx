import {Keyboard} from 'react-native'
import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {type NavigationAction} from '@react-navigation/native'
import {act, fireEvent, render} from '@testing-library/react-native'

import {logger} from '#/logger'
import * as Toast from '#/components/Toast'
import {type Costume} from '#/features/halloween/costumes/model'
import {
  CostumeConflictError,
  originalAvatarUrl,
} from '#/features/halloween/costumes/records'
import {type useDrawing} from '#/features/halloween/costumes/useDrawing'
import {CostumeEditorScreen} from './index'

const mockRender = jest.fn()
const mockPublish = jest.fn()
jest.mock('#/logger', () => ({logger: {error: jest.fn()}}))
const mockUpload = jest.fn()
const mockDispose = jest.fn()
const mockOpenComposer = jest.fn()
const mockInvalidate = jest.fn()
const mockClient = {}
let mockSeason = true
jest.mock('#/features/halloween/context', () => ({
  useHalloween: () => ({isHalloween: mockSeason, isActive: false}),
}))
jest.mock('#/components/Typography', () => ({
  Text: jest.requireActual<typeof import('react-native')>('react-native').Text,
}))
jest.mock('#/lib/api', () => ({
  uploadBlob: (...args: unknown[]) => mockUpload(...args),
}))
jest.mock('#/lib/hooks/useOpenComposer', () => ({
  useOpenComposer: () => ({openComposer: mockOpenComposer}),
}))
jest.mock('#/state/queries/profile', () => ({
  RQKEY: (did: string) => ['profile', did],
  profilesQueryKeyRoot: 'profiles',
}))
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({data: {head: 'head'}}),
  useQueryClient: () => ({
    invalidateQueries: mockInvalidate,
    setQueryData: jest.fn(),
  }),
}))
jest.mock('#/features/halloween/costumes/records', () => ({
  loadCostumeSource: jest.fn(),
  CostumeConflictError: class extends Error {},
  waitForCostumeAvatar: () => Promise.resolve(),
  originalAvatarUrl: jest.fn(() => 'https://original/avatar.png'),
  publishCostume: (...args: unknown[]) => mockPublish(...args),
}))
jest.mock('#/features/halloween/costumes/render', () => ({
  COSTUME_IMAGE_SIZE: 512,
  renderCostume: (...args: unknown[]) => mockRender(...args),
}))
jest.mock('#/features/halloween/costumes/imageFile', () => ({
  createCostumeImageFile: () =>
    Promise.resolve({uri: 'file:///costume.png', dispose: mockDispose}),
}))
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
  useSession: () => ({
    currentAccount: {
      did: mockDid,
      pdsUrl: 'https://actual-pds.example',
      service: 'https://entryway.example',
    },
  }),
  usePdsClient: () => mockClient,
  useAppviewClient: () => mockClient,
}))
jest.mock('#/state/queries/useCurrentAccountProfile', () => ({
  useCurrentAccountProfile: () => ({did: mockDid}),
}))
jest.mock('#/state/shell', () => ({
  useSetDrawerSwipeDisabled: () => mockDrawer,
}))
jest.mock('#/features/halloween/costumes/state', () => ({
  useCostumes: () => ({costumes: mockCostumes}),
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
  const {Pressable, Text, View} = require('react-native')
  const React = require('react') as typeof import('react')
  return {
    usePromptControl: () =>
      React.useMemo(() => {
        const control = {
          open: jest.fn(),
          onClose: () => {},
          close: (callback?: () => void) => {
            control.onClose()
            callback?.()
          },
        }
        return control
      }, []),
    Outer: ({
      children,
      control,
      onClose,
    }: React.PropsWithChildren<{
      control: {onClose: () => void}
      onClose: () => void
    }>) => {
      control.onClose = onClose
      return (
        <View>
          {children}
          <Pressable
            accessibilityRole="button"
            testID="dismissCollect"
            onPress={onClose}
          />
        </View>
      )
    },
    TitleText: Text,
    DescriptionText: Text,
    Actions: View,
    Action: ({cta, onPress}: {cta: string; onPress: () => void}) => (
      <Pressable accessibilityRole="button" testID={cta} onPress={onPress}>
        <Text>{cta}</Text>
      </Pressable>
    ),
    Cancel: () => null,
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
  mockSeason = true
  mockCostumes = {}
  mockPrevented = false
  mockPublish.mockResolvedValue({costumeNumber: 1})
  mockRender.mockResolvedValue(new Uint8Array([1]))
  mockUpload.mockResolvedValue({blob: {}})
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

it('passes the actual PDS host to the original photo URL rather than the login entryway', () => {
  render(element())
  expect(originalAvatarUrl).toHaveBeenCalledWith(
    'did:plc:alice',
    {head: 'head'},
    'https://actual-pds.example',
  )
})

it('does not publish costumes outside the shared window even from an already open editor', async () => {
  const screen = render(element())
  fireEvent.press(screen.getByTestId('paint'))
  mockSeason = false
  screen.rerender(element())
  expect(screen.getByTestId('costumeSave')).toBeDisabled()
  await act(async () => {
    fireEvent.press(screen.getByTestId('Update your public profile picture?'))
    await Promise.resolve()
  })
  expect(mockUpload).not.toHaveBeenCalled()
  expect(mockPublish).not.toHaveBeenCalled()
})

it('requires confirmation, publishes the avatar, then offers a seeded costume post', async () => {
  const screen = render(element())
  expect(mockDrawer).toHaveBeenCalledWith(true)
  expect(mockPrevented).toBe(false)
  fireEvent.press(screen.getByTestId('paint'))
  expect(mockPrevented).toBe(true)
  fireEvent.press(screen.getByTestId('costumeSave'))
  expect(mockPublish).not.toHaveBeenCalled()
  await act(async () => {
    fireEvent.press(screen.getByTestId('Update your public profile picture?'))
    await Promise.resolve()
  })
  expect(mockUpload).toHaveBeenCalledWith(
    mockClient,
    'file:///costume.png',
    'image/png',
  )
  expect(mockPublish).toHaveBeenCalledWith(
    mockClient,
    {head: 'head'},
    expect.objectContaining({version: 2, gridSize: 64}),
    {},
  )
  expect(mockPrevented).toBe(false)
  expect(mockNavigation.goBack).not.toHaveBeenCalled()
  fireEvent.press(screen.getByTestId('Create post'))
  expect(mockOpenComposer).toHaveBeenCalledWith(
    expect.objectContaining({
      halloweenCostumeNumber: 1,
      text: expect.stringContaining('Trick or treat!'),
      imageUris: [
        {
          uri: 'file:///costume.png',
          width: 512,
          height: 512,
          altText: 'My Halloween costume',
        },
      ],
    }),
  )
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
  expect(mockPublish).not.toHaveBeenCalled()
})

it('does not resume a canceled destination when saving later', async () => {
  const screen = render(element())
  fireEvent.press(screen.getByTestId('paint'))
  act(() => mockPreventCallback({data: {action: {type: 'NAVIGATE'}}}))
  await act(async () => {
    fireEvent.press(screen.getByTestId('Update your public profile picture?'))
    await Promise.resolve()
  })
  fireEvent.press(screen.getByTestId('dismissCollect'))
  expect(mockNavigation.dispatch).not.toHaveBeenCalled()
  expect(mockNavigation.goBack).toHaveBeenCalledTimes(1)
})

it('reports image preparation failures instead of falsely blaming the profile', async () => {
  const error = new Error('The photo could not be read from canvas')
  mockRender.mockRejectedValueOnce(error)
  const screen = render(element())
  fireEvent.press(screen.getByTestId('paint'))
  await act(async () => {
    fireEvent.press(screen.getByTestId('Update your public profile picture?'))
    await Promise.resolve()
  })
  expect(mockUpload).not.toHaveBeenCalled()
  expect(Toast.show).toHaveBeenCalledWith(
    'Could not prepare your costume image. The photo could not be read from canvas',
    {type: 'error'},
  )
  expect(logger.error).toHaveBeenCalledWith('Costume publication failed', {
    stage: 'image',
    safeMessage: error,
  })
})

it('reports upload errors and cleans up without attempting a profile write', async () => {
  mockUpload.mockRejectedValueOnce(new Error('Image upload rejected'))
  const screen = render(element())
  fireEvent.press(screen.getByTestId('paint'))
  await act(async () => {
    fireEvent.press(screen.getByTestId('Update your public profile picture?'))
    await Promise.resolve()
  })
  expect(mockPublish).not.toHaveBeenCalled()
  expect(mockDispose).toHaveBeenCalled()
  expect(Toast.show).toHaveBeenCalledWith(
    'Could not upload your costume image. Image upload rejected',
    {type: 'error'},
  )
})

it('only asks to reopen the editor for an actual avatar or costume conflict', async () => {
  mockPublish.mockRejectedValueOnce(new CostumeConflictError())
  const screen = render(element())
  fireEvent.press(screen.getByTestId('paint'))
  await act(async () => {
    fireEvent.press(screen.getByTestId('Update your public profile picture?'))
    await Promise.resolve()
  })
  expect(Toast.show).toHaveBeenCalledWith(
    'Your profile picture or costume changed in another window. Reopen the studio before publishing this drawing.',
    {type: 'error'},
  )
  expect(logger.error).not.toHaveBeenCalled()
})

it('keeps a failed save editable and never carries a draft into a switched account', async () => {
  mockPublish.mockRejectedValueOnce(new Error('InvalidSwap'))
  const screen = render(element())
  fireEvent.press(screen.getByTestId('paint'))
  await act(async () => {
    fireEvent.press(screen.getByTestId('Update your public profile picture?'))
    await Promise.resolve()
  })
  expect(mockDispose).toHaveBeenCalled()
  expect(mockNavigation.goBack).not.toHaveBeenCalled()
  expect(mockPrevented).toBe(true)
  mockDid = 'did:plc:bob'
  screen.rerender(element())
  expect(mockPrevented).toBe(false)
})
