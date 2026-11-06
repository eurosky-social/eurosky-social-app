import {StyleSheet, View, type ViewStyle} from 'react-native'
import {render} from '@testing-library/react-native'

import {getProduct, PRODUCT} from '#/config/product'
import {DesktopLeftNav} from './LeftNav'

jest.mock('#/config/product', () => {
  const actual =
    jest.requireActual<typeof import('#/config/product')>('#/config/product')
  return {...actual, PRODUCT: actual.getProduct('social')}
})
jest.mock('@lingui/react', () => ({
  useLingui: () => ({
    _: (message: {id: string}) => message.id,
    i18n: {_: (message: {id: string}) => message.id},
  }),
}))
jest.mock('@react-navigation/native', () => ({
  useNavigationState: (selector: (state: object) => unknown) => selector({}),
  useNavigation: () => ({}),
}))
jest.mock('#/lib/hooks/useAccountSwitcher', () => ({}))
jest.mock('#/lib/hooks/useOpenComposer', () => ({}))
jest.mock('#/lib/routes/helpers', () => ({
  getCurrentRoute: () => ({name: 'Home'}),
  isTab: () => false,
  isCurrentProfileRoute: () => false,
}))
jest.mock('#/lib/routes/links', () => ({}))
jest.mock('#/state/session', () => ({
  useSession: () => ({
    hasSession: mockHasSession,
    currentAccount: {did: 'did:plc:alice', handle: 'alice.test'},
    accounts: [{did: 'did:plc:alice', handle: 'alice.test'}],
  }),
  useSessionApi: () => ({}),
}))
jest.mock('#/state/queries/profile', () => ({
  useProfilesQuery: () => ({isLoading: true}),
}))
jest.mock('#/state/queries/handle', () => ({}))
jest.mock('#/state/queries/messages/list-conversations', () => ({
  useUnreadMessageCount: () => ({}),
}))
jest.mock('#/state/queries/moderation-inbox', () => ({
  useModerationInboxUnreadCountQuery: () => ({}),
}))
jest.mock('#/state/queries/notifications/unread', () => ({
  useUnreadNotifications: () => undefined,
}))
jest.mock('#/state/home-badge', () => ({useHomeBadge: () => false}))
jest.mock('#/state/events', () => ({}))
jest.mock('#/state/shell/logged-out', () => ({}))
jest.mock('#/state/util', () => ({}))
jest.mock('#/view/com/util/LoadingPlaceholder', () => ({
  LoadingPlaceholder: () => null,
}))
jest.mock('#/view/com/util/PressableWithHover', () => ({
  PressableWithHover: (require('react-native') as typeof import('react-native'))
    .View,
}))
jest.mock('#/view/com/util/UserAvatar', () => ({}))
jest.mock('#/view/shell/NavSignupCard', () => ({NavSignupCard: () => null}))
jest.mock('#/screens/Shorts/Theme', () => ({
  ShortsTheme: ({children}: React.PropsWithChildren<{}>) => {
    const {View} = require('react-native') as typeof import('react-native')
    return <View testID="shortsSidebarTheme">{children}</View>
  },
}))
jest.mock('#/alf', () => ({
  atoms: new Proxy(
    {},
    {
      get: (_target, key) =>
        key === 'bottom_0' ? {bottom: 0} : {transform: []},
    },
  ),
  tokens: {space: {lg: 16}},
  useBreakpoints: () => ({gtMobile: true}),
  useLayoutBreakpoints: () => ({leftNavMinimal: mockMinimal}),
  useTheme: () => ({atoms: {text: {color: '#111111'}}, palette: {}}),
  web: (style: object) => style,
  native: () => ({}),
}))
jest.mock('#/components/Button', () => ({}))
jest.mock('#/components/icons/BrandLogo', () => ({
  BrandLogo: (props: object) => {
    const {View} = require('react-native') as typeof import('react-native')
    return <View testID="sidebar-brand" {...props} />
  },
}))
jest.mock('#/components/Menu', () => ({}))
jest.mock('#/components/Prompt', () => ({
  usePromptControl: () => ({}),
  Basic: () => null,
}))
jest.mock('#/components/Typography', () => ({
  Text: (require('react-native') as typeof import('react-native')).Text,
}))
jest.mock('#/ageAssurance', () => ({
  useAgeAssurance: () => ({
    state: {access: 'full'},
    Access: {Full: 'full'},
    flags: {},
  }),
}))
jest.mock('#/analytics', () => ({
  useAnalytics: () => ({features: {enabled: () => false}, metric: jest.fn()}),
}))
jest.mock('#/env', () => ({IS_NATIVE: false, IS_WEB: true, IS_IOS: false}))
jest.mock('#/features/followingV2/eligibility', () => ({
  isFollowingV2HomeDotEnabled: () => false,
}))
jest.mock('#/features/liveNow', () => ({useActorStatus: () => ({})}))
jest.mock('#/features/product/navigation/model', () => ({
  isNavigationActive: () => false,
}))
jest.mock('#/features/product/navigation/useProductNavigation', () => ({
  useProductNavigation: () => {
    const {PRODUCT} =
      require('#/config/product') as typeof import('#/config/product')
    return PRODUCT.navigation.sidebar.map(id => ({
      id,
      href: `/${id}`,
      metricItem: id,
      label: {id},
      routes: [],
      icons: {active: () => null, inactive: () => null},
    }))
  },
}))
jest.mock('#/routes', () => ({router: {matchPath: () => ['Home']}}))

let mockHasSession = true
let mockMinimal = false

beforeEach(() => {
  mockHasSession = true
  mockMinimal = false
  jest.replaceProperty(PRODUCT, 'capabilities', {
    ...PRODUCT.capabilities,
    standalonePosting: false,
  })
})
afterEach(() => jest.restoreAllMocks())

it.each([false, true])(
  'pins the news account control below its links (minimal: %s)',
  minimal => {
    mockMinimal = minimal
    jest.replaceProperty(PRODUCT, 'id', 'news')
    jest.replaceProperty(PRODUCT, 'navigation', getProduct('news').navigation)
    const screen = render(<DesktopLeftNav routeName="Home" />)
    const account = screen
      .UNSAFE_getAllByType(View)
      .find(node => node.props.testID === 'desktop-account-control')!
    const navigation = screen
      .UNSAFE_getAllByType(View)
      .find(node => node.props.role === 'navigation')!
    const links = screen
      .UNSAFE_getAllByType(View)
      .filter(node => node.props.role === 'link')
    expect(links.map(link => link.props.accessibilityLabel)).toEqual([
      'home',
      'publisher',
      'shorts',
      'profile',
    ])
    const section = screen
      .UNSAFE_getAllByType(View)
      .find(
        node =>
          StyleSheet.flatten(node.props.style as ViewStyle[])?.marginTop ===
          'auto',
      )
    expect(section).toBeDefined()
    expect(
      section!.findAllByProps({testID: 'desktop-account-control'}),
    ).not.toHaveLength(0)
    expect(StyleSheet.flatten(navigation.props.style)).toMatchObject({
      bottom: 0,
    })
    const nodes = screen.UNSAFE_getAllByType(View)
    expect(nodes.indexOf(account)).toBeGreaterThan(nodes.indexOf(links.at(-1)!))
    expect(screen.getByTestId('sidebar-brand').props.variant).toBe(
      minimal ? 'mark' : 'wordmark',
    )
  },
)

it.each([false, true])(
  'scopes the dark sidebar theme to Shorts (signed in: %s)',
  hasSession => {
    mockHasSession = hasSession
    const screen = render(<DesktopLeftNav routeName="Shorts" />)
    expect(screen.getByTestId('shortsSidebarTheme')).toBeTruthy()
    screen.rerender(<DesktopLeftNav routeName="Home" />)
    expect(screen.queryByTestId('shortsSidebarTheme')).toBeNull()
  },
)

it('preserves the social account control above its links', () => {
  jest.replaceProperty(PRODUCT, 'capabilities', {
    ...PRODUCT.capabilities,
    standalonePosting: false,
  })
  const screen = render(<DesktopLeftNav routeName="Home" />)
  const nodes = screen.UNSAFE_getAllByType(View)
  expect(
    nodes.indexOf(
      nodes.find(node => node.props.testID === 'desktop-account-control')!,
    ),
  ).toBeLessThan(nodes.indexOf(nodes.find(node => node.props.role === 'link')!))
  expect(screen.queryByTestId('sidebar-brand')).toBeNull()
})

it('does not expose an account control to signed-out visitors', () => {
  mockHasSession = false
  jest.replaceProperty(PRODUCT, 'id', 'news')
  jest.replaceProperty(PRODUCT, 'navigation', {
    ...getProduct('news').navigation,
    sidebar: [],
  })
  const screen = render(<DesktopLeftNav routeName="Home" />)
  expect(screen.queryByTestId('desktop-account-control')).toBeNull()
})
