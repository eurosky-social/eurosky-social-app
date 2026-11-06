import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {fireEvent, render} from '@testing-library/react-native'

import {ShareMenuItems as NativeShareMenu} from '#/components/PostControls/ShareMenu/ShareMenuItems'
import {ShareMenuItems as WebShareMenu} from '#/components/PostControls/ShareMenu/ShareMenuItems.web'
import {getProduct, PRODUCT} from '#/config/product'

const mockOpen = jest.fn()
const mockRecentChats = jest.fn(() => null)
jest.mock('#/config/product', () => {
  const actual = jest.requireActual<{getProduct: typeof getProduct}>(
    '#/config/product',
  )
  return {...actual, PRODUCT: actual.getProduct('social')}
})
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: jest.fn()}),
}))
jest.mock('@tanstack/react-query', () => ({useQueryClient: () => ({})}))
jest.mock('#/lib/sharing', () => ({
  shareUrl: jest.fn(),
  simpleShareText: jest.fn(),
}))
jest.mock('#/state/cache/profile-shadow', () => ({
  useProfileShadow: (profile: object) => profile,
}))
jest.mock('#/state/queries/post', () => ({precachePost: jest.fn()}))
jest.mock('#/state/session', () => ({useSession: () => ({hasSession: true})}))
jest.mock('#/alf', () => ({
  atoms: {},
  useBreakpoints: () => ({gtMobile: false}),
}))
jest.mock('#/components/Admonition', () => ({Admonition: () => null}))
jest.mock('#/components/Dialog', () => ({
  useDialogControl: () => ({open: mockOpen}),
}))
jest.mock('#/components/dialogs/Embed', () => ({EmbedDialog: () => null}))
jest.mock('#/components/dms/dialogs/ShareViaChatDialog', () => ({
  SendViaChatDialog: () => null,
}))
jest.mock('#/components/PostControls/ShareMenu/RecentChats', () => ({
  RecentChats: () => mockRecentChats(),
}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))
jest.mock('#/ageAssurance', () => ({
  useAgeAssurance: () => ({state: {access: 'full'}, Access: {Full: 'full'}}),
}))
jest.mock('#/analytics', () => ({useAnalytics: () => ({metric: jest.fn()})}))
jest.mock('#/storage/hooks/dev-mode', () => ({useDevMode: () => [false]}))
jest.mock('#/components/Menu', () => {
  const {View, Pressable} = require('react-native')
  return {
    Outer: View,
    Group: View,
    ContainerItem: View,
    Item: Pressable,
    ItemText: View,
    ItemIcon: () => null,
    Divider: View,
    LabelText: View,
  }
})

beforeEach(() => i18n.loadAndActivate({locale: 'en', messages: {}}))
afterEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
})

it.each([
  ['native', NativeShareMenu],
  ['web', WebShareMenu],
] as const)(
  'removes news chat sharing and recent conversations on %s without removing link sharing',
  (_platform, Component) => {
    jest.replaceProperty(
      PRODUCT,
      'capabilities',
      getProduct('news').capabilities,
    )
    const screen = render(
      <I18nProvider i18n={i18n}>
        <Component
          post={
            {
              uri: 'at://did:plc:alice/app.bsky.feed.post/123',
              author: {did: 'did:plc:alice', handle: 'alice.test'},
            } as never
          }
          record={{} as never}
          timestamp="now"
          onShare={jest.fn()}
          testID="share"
          richText={{} as never}
        />
      </I18nProvider>,
    )
    expect(screen.queryByTestId('postDropdownSendViaDMBtn')).toBeNull()
    expect(
      screen.getAllByTestId('postDropdownShareBtn').length,
    ).toBeGreaterThan(0)
    expect(mockRecentChats).not.toHaveBeenCalled()
    expect(mockOpen).not.toHaveBeenCalled()
  },
)

it.each([
  ['native', NativeShareMenu],
  ['web', WebShareMenu],
] as const)('retains social chat sharing on %s', (_platform, Component) => {
  const screen = render(
    <I18nProvider i18n={i18n}>
      <Component
        post={
          {
            uri: 'at://did:plc:alice/app.bsky.feed.post/123',
            author: {did: 'did:plc:alice', handle: 'alice.test'},
          } as never
        }
        record={{} as never}
        timestamp="now"
        onShare={jest.fn()}
        testID="share"
        richText={{} as never}
      />
    </I18nProvider>,
  )
  fireEvent.press(screen.getByTestId('postDropdownSendViaDMBtn'))
  expect(mockOpen).toHaveBeenCalledTimes(1)
})
