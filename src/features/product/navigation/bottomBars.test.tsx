import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {fireEvent, render} from '@testing-library/react-native'

import {type State} from '#/lib/routes/types'
import {emitSoftReset} from '#/state/events'
import {BottomBar} from '#/view/shell/bottom-bar/BottomBar'
import {BottomBarWeb} from '#/view/shell/bottom-bar/BottomBarWeb'
import {getProduct, PRODUCT} from '#/config/product'

let mockState: State = {
  index: 0,
  routes: [{name: 'HomeTab', state: {index: 0, routes: [{name: 'Home'}]}}],
}
const mockSwitchAccount = jest.fn()
const mockNavigation = {
  getState: () => mockState,
  dispatch: jest.fn(),
  reset: jest.fn(),
  navigate: jest.fn(),
}

jest.mock('react-native-reanimated', () => {
  const {View} = require('react-native')
  return {__esModule: true, default: {View}}
})
jest.mock('#/config/product', () => {
  const actual = jest.requireActual<{getProduct: typeof getProduct}>(
    '#/config/product',
  )
  return {...actual, PRODUCT: actual.getProduct('social')}
})
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual<object>('@react-navigation/native'),
  useNavigationState: (select: (state: typeof mockState) => unknown) =>
    select(mockState),
}))
jest.mock('#/state/session', () => ({
  useSession: () => ({
    hasSession: true,
    currentAccount: {did: 'did:plc:alice', handle: 'alice.test'},
  }),
}))
jest.mock('#/analytics', () => ({
  useAnalytics: () => ({metric: jest.fn(), features: {enabled: () => false}}),
}))
jest.mock('#/features/newsFeed/config', () => ({NEWS_V2_ENABLED: true}))
jest.mock('#/features/followingV2/eligibility', () => ({
  isFollowingV2HomeDotEnabled: () => false,
}))
jest.mock('#/features/liveNow', () => ({
  useActorStatus: () => ({isActive: false}),
}))
jest.mock('#/state/home-badge', () => ({useHomeBadge: () => false}))
jest.mock('#/state/events', () => ({emitSoftReset: jest.fn()}))
jest.mock('#/state/queries/messages/list-conversations', () => ({
  useUnreadMessageCount: () => ({}),
}))
jest.mock('#/state/queries/messages/update-all-read', () => ({
  useUpdateAllRead: () => ({mutate: jest.fn()}),
}))
jest.mock('#/state/queries/notifications/unread', () => ({
  useUnreadNotifications: () => '',
}))
jest.mock('#/state/queries/profile', () => ({
  useProfileQuery: () => ({data: {}}),
}))
jest.mock('#/state/shell/logged-out', () => ({
  useLoggedOutViewControls: () => ({requestSwitchToAccount: jest.fn()}),
}))
jest.mock('#/state/shell/shell-layout', () => ({
  useShellLayout: () => ({footerHeight: {set: jest.fn()}}),
}))
jest.mock('#/state/util', () => ({useCloseAllActiveElements: () => jest.fn()}))
jest.mock('#/lib/hooks/useDedupe', () => ({
  useDedupe: () => (callback: () => void) => callback(),
}))
jest.mock('#/lib/hooks/useHideBottomBarBorder', () => ({
  useHideBottomBarBorder: () => false,
}))
jest.mock('#/lib/hooks/useMinimalShellTransform', () => ({
  useMinimalShellFooterTransform: () => ({}),
}))
jest.mock('#/lib/haptics', () => ({useHaptics: () => ({longPress: jest.fn()})}))
jest.mock('#/storage/hooks/demo-mode', () => ({useDemoMode: () => [false]}))
jest.mock('#/ageAssurance', () => ({
  useAgeAssurance: () => ({flags: {chatDisabled: false}}),
}))
jest.mock('#/view/com/util/UserAvatar', () => ({UserAvatar: () => null}))
jest.mock('#/view/icons/Logotype', () => ({Logotype: () => null}))
jest.mock('#/alf', () => ({
  atoms: {},
  tokens: {space: {sm: 8}},
  useTheme: () => ({
    atoms: {bg: {}, text: {color: 'black'}},
    palette: {primary_500: 'pink'},
  }),
}))
jest.mock('#/components/Dialog', () => ({
  useDialogControl: () => ({open: mockSwitchAccount}),
}))
jest.mock('#/components/dialogs/SwitchAccount', () => ({
  SwitchAccountDialog: () => null,
}))
jest.mock('#/components/Menu', () => ({
  useMenuControl: () => ({open: jest.fn()}),
  Root: () => null,
}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
jest.mock('#/components/Typography', () => {
  const {Text} = require('react-native')
  return {Text}
})
jest.mock('#/components/Button', () => ({
  Button: () => null,
  ButtonText: () => null,
}))
jest.mock('#/lib/custom-animations/PressableScale', () => {
  const {Pressable} = require('react-native')
  return {PressableScale: Pressable}
})
jest.mock('#/view/com/util/Link', () => {
  const {Pressable} = require('react-native')
  return {Link: (props: object) => <Pressable {...props} />}
})

beforeEach(() => {
  i18n.loadAndActivate({locale: 'en', messages: {}})
  mockState = {
    index: 0,
    routes: [{name: 'HomeTab', state: {index: 0, routes: [{name: 'Home'}]}}],
  }
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

function renderBar(platform: 'native' | 'web') {
  const props = {
    navigation: mockNavigation,
    state: mockState,
  } as unknown as React.ComponentProps<typeof BottomBar>
  return render(
    <I18nProvider i18n={i18n}>
      {platform === 'native' ? <BottomBar {...props} /> : <BottomBarWeb />}
    </I18nProvider>,
  )
}

it.each(['native', 'web'] as const)(
  'orders and hides %s buttons from the preset, including a page without a custom slot',
  platform => {
    jest.replaceProperty(PRODUCT, 'navigation', {
      ...PRODUCT.navigation,
      bottomBar: ['news', 'home', 'settings'],
    })
    const screen = renderBar(platform)
    expect(screen.queryByLabelText('Chat')).toBeNull()
    expect(screen.queryByLabelText('Profile')).toBeNull()
    expect(
      screen
        .getAllByLabelText(/^(News|Home|Settings)$/)
        .map(node => node.props.accessibilityLabel ?? node.props['aria-label']),
    ).toEqual(['News', 'Home', 'Settings'])
  },
)

it.each(['native', 'web'] as const)(
  'shows only Home, Profile, and Settings in the news %s bottom bar',
  platform => {
    jest.replaceProperty(PRODUCT, 'navigation', getProduct('news').navigation)
    const screen = renderBar(platform)
    expect(
      screen
        .getAllByLabelText(/^(Home|Profile|Settings)$/)
        .map(node => node.props.accessibilityLabel ?? node.props['aria-label']),
    ).toEqual(['Home', 'Profile', 'Settings'])
    expect(screen.queryByLabelText('Search')).toBeNull()
    expect(screen.queryByLabelText('Chat')).toBeNull()
    expect(screen.queryByLabelText('Notifications')).toBeNull()
  },
)

it('supports a native-only bottom-bar override without changing web', () => {
  jest.replaceProperty(PRODUCT, 'navigation', {
    ...PRODUCT.navigation,
    bottomBar: ['home'],
    nativeBottomBar: ['news'],
  })
  const native = renderBar('native')
  expect(native.queryByLabelText('Home')).toBeNull()
  expect(native.getByLabelText('News')).toBeTruthy()
  native.unmount()
  const web = renderBar('web')
  expect(web.queryByLabelText('News')).toBeNull()
  expect(web.getByLabelText('Home')).toBeTruthy()
})

it('opens a common news screen in the active native stack', () => {
  jest.replaceProperty(PRODUCT, 'navigation', {
    ...PRODUCT.navigation,
    bottomBar: ['news', 'home'],
  })
  const screen = renderBar('native')
  fireEvent.press(screen.getByLabelText('News'))
  expect(mockNavigation.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({
        name: 'HomeTab',
        params: {screen: 'NewsExplore', params: undefined},
      }),
    }),
  )
})

it('preserves independent native tab stacks for added bottom-bar destinations', () => {
  jest.replaceProperty(PRODUCT, 'navigation', {
    ...PRODUCT.navigation,
    bottomBar: ['settings', 'news'],
  })
  const screen = renderBar('native')
  fireEvent.press(screen.getByLabelText('Settings'))
  expect(mockNavigation.navigate).toHaveBeenCalledWith('SettingsTab')
})

it('pops a newly exposed native tab to its own root on reselect', () => {
  jest.replaceProperty(PRODUCT, 'navigation', {
    ...PRODUCT.navigation,
    bottomBar: ['settings'],
  })
  mockState = {
    index: 0,
    routes: [
      {
        name: 'SettingsTab',
        state: {
          key: 'settings-stack',
          index: 1,
          routes: [{name: 'Settings'}, {name: 'AccountSettings'}],
        },
      },
    ],
  }
  const screen = renderBar('native')
  fireEvent.press(screen.getByLabelText('Settings'))
  expect(mockNavigation.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({type: 'POP_TO_TOP', target: 'settings-stack'}),
  )
})

it('selects News instead of its parent Home tab and returns from a related article', () => {
  jest.replaceProperty(PRODUCT, 'navigation', {
    ...PRODUCT.navigation,
    bottomBar: ['news', 'home'],
  })
  mockState = {
    index: 0,
    routes: [
      {
        name: 'HomeTab',
        state: {
          index: 1,
          routes: [{name: 'NewsExplore'}, {name: 'NewsArticle'}],
        },
      },
    ],
  }
  const screen = renderBar('native')
  expect(screen.getByLabelText('News').props.accessibilityState).toMatchObject({
    selected: true,
  })
  expect(screen.getByLabelText('Home').props.accessibilityState).toMatchObject({
    selected: false,
  })
  fireEvent.press(screen.getByLabelText('News'))
  expect(emitSoftReset).not.toHaveBeenCalled()
  expect(mockNavigation.dispatch).toHaveBeenCalled()
})

it('preserves native home reselect and profile long press', () => {
  const screen = renderBar('native')
  fireEvent.press(screen.getByLabelText('Home'))
  expect(emitSoftReset).toHaveBeenCalledTimes(1)
  fireEvent(screen.getByLabelText('Profile'), 'longPress')
  expect(mockSwitchAccount).toHaveBeenCalledTimes(1)
})

it('uses the matching web URL and a translated accessible name for generic pages', () => {
  jest.replaceProperty(PRODUCT, 'navigation', {
    ...PRODUCT.navigation,
    bottomBar: ['news'],
  })
  const screen = renderBar('web')
  expect(screen.getByLabelText('News').props.href).toBe('/news/explore')
  const {accessibilityLabel, 'aria-label': ariaLabel} =
    screen.getByLabelText('News').props
  expect(accessibilityLabel ?? ariaLabel).toBe('News')
})
