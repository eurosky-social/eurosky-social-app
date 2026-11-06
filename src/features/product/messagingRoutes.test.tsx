import {Text} from 'react-native'
import {render} from '@testing-library/react-native'

import {createNativeStackNavigatorWithAuth} from '#/view/shell/createNativeStackNavigatorWithAuth'
import {getProduct, PRODUCT} from '#/config/product'
import * as env from '#/env'

let mockRoute = 'Messages'
let mockHasSession = false
let mockBackgroundChat = false
const mockChatScreen = jest.fn(() => <Text>Chat mounted</Text>)
const mockLoginScreen = jest.fn(() => <Text>Sign in</Text>)

jest.mock('#/config/product', () => {
  const actual = jest.requireActual<{getProduct: typeof getProduct}>(
    '#/config/product',
  )
  return {...actual, PRODUCT: actual.getProduct('social')}
})
jest.mock('#/env', () => ({IS_NATIVE: true, IS_WEB: false}))
jest.mock('@react-navigation/native', () => {
  const {Text} = require('react-native')
  return {
    createNavigatorFactory: (Navigator: unknown) => () => ({Navigator}),
    StackRouter: jest.fn(),
    StackActions: {popToTop: jest.fn()},
    useNavigationBuilder: () => {
      const routes = [
        {name: mockRoute, key: 'active'},
        ...(mockBackgroundChat
          ? [{name: 'MessagesConversation', key: 'background'}]
          : []),
      ]
      return {
        state: {index: 0, routes},
        descriptors: Object.fromEntries(
          routes.map(route => [
            route.key,
            {
              route,
              options: {requireAuth: mockRoute.startsWith('Messages')},
              render: route.name.startsWith('Messages')
                ? mockChatScreen
                : () => <Text>Home mounted</Text>,
            },
          ]),
        ),
        navigation: {addListener: jest.fn()},
        describe: jest.fn(),
        NavigationContent: ({children}: {children: React.ReactNode}) =>
          children,
      }
    },
  }
})
jest.mock('@react-navigation/native-stack', () => {
  const {Text} = require('react-native')
  return {
    NativeStackView: ({
      descriptors,
    }: {
      descriptors: Record<string, {render: () => React.ReactNode}>
    }) =>
      Object.entries(descriptors).map(([key, descriptor]) => (
        <Text key={key}>{descriptor.render()}</Text>
      )),
  }
})
jest.mock('#/lib/hooks/useWebMediaQueries', () => ({
  useWebMediaQueries: () => ({isMobile: true}),
}))
jest.mock('#/state/session', () => ({
  useSession: () => ({hasSession: mockHasSession}),
}))
jest.mock('#/state/shell', () => ({
  useOnboardingState: () => ({isActive: false}),
}))
jest.mock('#/state/shell/logged-out', () => ({
  useLoggedOutView: () => ({showLoggedOut: false}),
  useLoggedOutViewControls: () => ({setShowLoggedOut: jest.fn()}),
}))
jest.mock('#/view/com/auth/LoggedOut', () => ({
  LoggedOut: () => mockLoginScreen(),
}))
jest.mock('#/view/screens/NotFound', () => {
  const {Text} = require('react-native')
  return {NotFoundScreen: () => <Text>Unavailable</Text>}
})
jest.mock('#/screens/Onboarding', () => ({Onboarding: () => null}))
jest.mock('#/screens/SignupQueued', () => ({SignupQueued: () => null}))
jest.mock('#/alf', () => ({
  atoms: {flex_1: {}},
  useLayoutBreakpoints: () => ({leftNavMinimal: false}),
}))
jest.mock('#/components/PolicyUpdateOverlay', () => ({
  PolicyUpdateOverlay: () => null,
}))
jest.mock('#/view/shell/bottom-bar/BottomBarWeb', () => ({
  BottomBarWeb: () => null,
}))
jest.mock('#/view/shell/desktop/LeftNav', () => ({DesktopLeftNav: () => null}))
jest.mock('#/view/shell/desktop/RightNav', () => ({
  DesktopRightNav: () => null,
}))

const Navigator = createNativeStackNavigatorWithAuth().Navigator
beforeEach(() => {
  mockRoute = 'Messages'
  mockHasSession = false
  mockBackgroundChat = false
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

it.each([
  'Messages',
  'MessagesConversation',
  'MessagesSettings',
  'MessagesConversationSettings',
  'MessagesInbox',
  'MessagesJoinRequests',
])('rejects %s before auth and before mounting chat screens/layouts', name => {
  jest.replaceProperty(PRODUCT, 'capabilities', getProduct('news').capabilities)
  mockRoute = name
  const screen = render(
    <Navigator>
      <Text>Registered screens</Text>
    </Navigator>,
  )
  expect(screen.getByText('Unavailable')).toBeTruthy()
  expect(mockLoginScreen).not.toHaveBeenCalled()
  expect(mockChatScreen).not.toHaveBeenCalled()
})
it('rejects signed-in web chat routes as well', () => {
  jest.replaceProperty(PRODUCT, 'capabilities', getProduct('news').capabilities)
  jest.replaceProperty(env, 'IS_NATIVE', false)
  jest.replaceProperty(env, 'IS_WEB', true)
  mockHasSession = true
  expect(
    render(
      <Navigator>
        <Text>Registered screens</Text>
      </Navigator>,
    ).getByText('Unavailable'),
  ).toBeTruthy()
  expect(mockChatScreen).not.toHaveBeenCalled()
})
it('does not mount restored background messaging routes in a news stack', () => {
  jest.replaceProperty(PRODUCT, 'capabilities', getProduct('news').capabilities)
  mockHasSession = true
  mockRoute = 'Home'
  mockBackgroundChat = true
  const screen = render(
    <Navigator>
      <Text>Registered screens</Text>
    </Navigator>,
  )
  expect(screen.getByText('Home mounted')).toBeTruthy()
  expect(mockChatScreen).not.toHaveBeenCalled()
})
it('retains social chat authentication', () => {
  expect(
    render(
      <Navigator>
        <Text>Registered screens</Text>
      </Navigator>,
    ).getByText('Sign in'),
  ).toBeTruthy()
  expect(mockChatScreen).not.toHaveBeenCalled()
})
it('retains signed-in social chat screens', () => {
  mockHasSession = true
  expect(
    render(
      <Navigator>
        <Text>Registered screens</Text>
      </Navigator>,
    ).getByText('Chat mounted'),
  ).toBeTruthy()
})
