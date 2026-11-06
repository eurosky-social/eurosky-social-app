import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from '@testing-library/react-native'

import {useGroupChatJoinIntent} from '#/lib/hooks/useIntentHandler'
import {MessageProfileButton} from '#/components/dms/MessageProfileButton'
import {getProduct, PRODUCT} from '#/config/product'

let mockHasSession = true
const mockClose = jest.fn()
const mockSignIn = jest.fn()
const mockLanding = jest.fn()
const mockOpen = jest.fn()
const mockSetState = jest.fn()
const mockPrefetch = jest.fn(async () => {})
const mockAuth = jest.fn((callback: () => void) => callback)
const mockAvailability = jest.fn(() => ({data: {canChat: true}}))
const mockCreateConvo = jest.fn()
const mockNavigate = jest.fn()

jest.mock('#/config/product', () => {
  const actual = jest.requireActual<{getProduct: typeof getProduct}>(
    '#/config/product',
  )
  return {...actual, PRODUCT: actual.getProduct('social')}
})
jest.mock('expo-linking', () => ({}))
jest.mock('expo-web-browser', () => ({}))
jest.mock('@bsky.app/expo-bluesky-swiss-army', () => ({Referrer: {}}))
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}))
jest.mock('#/lib/hooks/useOTAUpdates', () => ({
  useApplyPullRequestOTAUpdate: () => ({}),
}))
jest.mock('#/lib/hooks/useOpenComposer', () => ({useOpenComposer: () => ({})}))
jest.mock('#/state/queries/join-links', () => ({
  usePrefetchJoinLinkPreviews: () => mockPrefetch,
}))
jest.mock('#/state/session', () => ({
  useSession: () => ({hasSession: mockHasSession}),
}))
jest.mock('#/state/shell/landing', () => ({
  useSetActiveLanding: () => mockLanding,
}))
jest.mock('#/state/shell/logged-out', () => ({
  useLoggedOutViewControls: () => ({requestSwitchToAccount: mockSignIn}),
}))
jest.mock('#/state/util', () => ({useCloseAllActiveElements: () => mockClose}))
jest.mock('#/components/intents/IntentDialogs', () => ({
  useIntentDialogs: () => ({
    groupChatJoinDialogControl: {open: mockOpen},
    setGroupChatJoinState: mockSetState,
  }),
}))
jest.mock('#/components/TrendingTopics', () => ({
  getTrendingTopicFeedUri: jest.fn(),
}))
jest.mock('#/analytics', () => ({useAnalytics: () => ({metric: jest.fn()})}))
jest.mock('#/lib/hooks/useRequireEmailVerification', () => ({
  useRequireEmailVerification: () => mockAuth,
}))
jest.mock('#/state/queries/messages/get-convo-availability', () => ({
  useGetConvoAvailabilityQuery: () => mockAvailability(),
}))
jest.mock('#/state/queries/messages/get-convo-for-members', () => ({
  useGetConvoForMembers: () => ({mutate: mockCreateConvo}),
}))
jest.mock('#/components/dms/util', () => ({canBeMessaged: () => true}))
jest.mock('#/alf', () => ({atoms: {}, useTheme: () => ({atoms: {text: {}}})}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
jest.mock('#/components/Button', () => {
  const {Pressable} = require('react-native')
  return {Button: Pressable, ButtonIcon: () => null}
})

beforeEach(() => {
  mockHasSession = true
  i18n.loadAndActivate({locale: 'en', messages: {}})
})
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

it.each([false, true])(
  'rejects news invite intents before auth or UI work (signed in: %s)',
  hasSession => {
    jest.replaceProperty(
      PRODUCT,
      'capabilities',
      getProduct('news').capabilities,
    )
    mockHasSession = hasSession
    const {result} = renderHook(useGroupChatJoinIntent)
    result.current('code', 'https://bsky.app/chat/code')
    expect(mockClose).not.toHaveBeenCalled()
    expect(mockSignIn).not.toHaveBeenCalled()
    expect(mockLanding).not.toHaveBeenCalled()
    expect(mockPrefetch).not.toHaveBeenCalled()
    expect(mockOpen).not.toHaveBeenCalled()
    expect(mockSetState).not.toHaveBeenCalled()
  },
)

it('retains signed-out social invitation authentication', () => {
  mockHasSession = false
  const {result} = renderHook(useGroupChatJoinIntent)
  result.current('code', 'https://bsky.app/chat/code')
  expect(mockSignIn).toHaveBeenCalledWith({requestedAccount: 'groupchat'})
  expect(mockLanding).toHaveBeenCalledWith({
    type: 'groupchat',
    code: 'code',
    uri: 'https://bsky.app/chat/code',
  })
})

it('retains signed-in social invite prefetch and dialog opening', async () => {
  const {result} = renderHook(useGroupChatJoinIntent)
  await act(async () => {
    result.current('code')
    await Promise.resolve()
  })
  await waitFor(() => expect(mockOpen).toHaveBeenCalled())
  expect(mockPrefetch).toHaveBeenCalledWith({codes: ['code'], hasSession: true})
})

it('does not mount the news profile message action or its availability/auth hooks', () => {
  jest.replaceProperty(PRODUCT, 'capabilities', getProduct('news').capabilities)
  const screen = render(
    <MessageProfileButton
      profile={{did: 'did:plc:bob', handle: 'bob.test'} as never}
    />,
  )
  expect(screen.toJSON()).toBeNull()
  expect(mockAvailability).not.toHaveBeenCalled()
  expect(mockAuth).not.toHaveBeenCalled()
})

it('retains the social profile message button and email guard', () => {
  const screen = render(
    <I18nProvider i18n={i18n}>
      <MessageProfileButton
        profile={{did: 'did:plc:bob', handle: 'bob.test'} as never}
      />
    </I18nProvider>,
  )
  fireEvent.press(screen.getByTestId('dmBtn'))
  expect(mockAvailability).toHaveBeenCalled()
  expect(mockAuth).toHaveBeenCalled()
  expect(mockCreateConvo).toHaveBeenCalledWith(['did:plc:bob'])
})
