import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {render} from '@testing-library/react-native'

import {PRODUCT} from '#/config/product'
import {PUBLISHERS} from '#/features/publishers/publishers'
import {ComposerReplyTo} from './ComposerReplyTo'

jest.mock('#/state/queries/post', () => ({
  usePostQuery: jest.fn(() => ({data: mockPost})),
}))
jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: () => ({}),
}))
jest.mock('@bsky/sdk/moderation', () => ({
  moderatePost: () => ({ui: () => ({blurs: [], filters: [], blur: false})}),
}))
jest.mock('#/view/com/util/UserAvatar', () => ({
  PreviewableUserAvatar: () => null,
}))
jest.mock('#/components/ProfileBadges', () => ({ProfileBadges: () => null}))
jest.mock('#/components/Post/Embed', () => ({QuoteEmbed: () => null}))
jest.mock('#/components/moderation/ContentHider', () => ({
  ContentHider: (require('react-native') as typeof import('react-native')).View,
}))
jest.mock('#/components/Typography', () => ({
  Text: (require('react-native') as typeof import('react-native')).Text,
}))
jest.mock('expo-image', () => ({
  Image: (require('react-native') as typeof import('react-native')).View,
}))
jest.mock('#/alf', () => ({
  atoms: new Proxy({}, {get: () => ({})}),
  useTheme: () => ({atoms: {}}),
  web: (value: unknown) => value,
  utils: {alpha: () => '#000'},
}))

const uri = `at://${PUBLISHERS[0].did}/app.bsky.feed.post/one` as const
const author = {
  did: PUBLISHERS[0].did,
  handle: PUBLISHERS[0].domain,
  displayName: PUBLISHERS[0].name,
}
const external = {
  $type: 'app.bsky.embed.external#view',
  external: {
    uri: 'https://example.com/story',
    title: 'The source headline',
    description: 'The source description',
    thumb: 'https://example.com/photo.jpg',
  },
}
let mockPost: object | undefined
const replyTo = {
  uri,
  cid: 'bafytest',
  text: 'Original publisher caption',
  author,
}
function root() {
  return (
    <I18nProvider i18n={i18n}>
      <ComposerReplyTo replyTo={replyTo} />
    </I18nProvider>
  )
}
beforeEach(() => {
  jest.replaceProperty(PRODUCT, 'id', 'news')
  i18n.loadAndActivate({locale: 'en', messages: {}})
  mockPost = {
    uri,
    cid: 'bafytest',
    author,
    record: {
      $type: 'app.bsky.feed.post',
      text: replyTo.text,
      createdAt: '2026-11-06T00:00:00Z',
    },
    embed: external,
    indexedAt: '2026-11-06T00:00:00Z',
  }
})
afterEach(() => jest.restoreAllMocks())
it('shows the real article headline, description and thumbnail in the publisher reply preview', () => {
  const view = render(root())
  expect(view.getByTestId('composerPublisherArticle')).toBeTruthy()
  expect(view.getByText('The source headline')).toBeTruthy()
  expect(view.getByText('The source description')).toBeTruthy()
})
it('keeps ordinary comment replies and social previews unchanged', () => {
  jest.replaceProperty(PRODUCT, 'id', 'social')
  const view = render(root())
  expect(view.queryByTestId('composerPublisherArticle')).toBeNull()
  expect(view.getByText(replyTo.text)).toBeTruthy()
})
it('falls back while the original post is loading, without inventing article metadata', () => {
  mockPost = undefined
  const view = render(root())
  expect(view.queryByTestId('composerPublisherArticle')).toBeNull()
  expect(view.getByText(replyTo.text)).toBeTruthy()
})
