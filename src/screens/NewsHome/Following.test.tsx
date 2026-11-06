import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {render} from '@testing-library/react-native'

import {PUBLISHERS} from '#/features/publishers/publishers'
import {FollowingNews} from './Following'

let mockProfiles = PUBLISHERS.map(publisher => ({
  did: publisher.did,
  handle: publisher.domain,
  displayName: publisher.name,
  viewer: {} as {following?: string},
}))
let mockError = false
const mockStories = jest.fn()
jest.mock('#/state/queries/profile', () => ({
  useProfilesQuery: () => ({
    data: {profiles: mockProfiles},
    isPending: false,
    isError: mockError,
    refetch: jest.fn(),
  }),
}))
jest.mock('#/state/cache/profile-shadow', () => ({
  useProfileShadows: (profiles: unknown) => profiles,
}))
jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: () => ({}),
}))
jest.mock('@bsky/sdk/moderation', () => ({
  moderateProfile: () => ({ui: () => ({filter: false})}),
}))
jest.mock('#/components/ProfileCard', () => ({
  Header: (require('react-native') as typeof import('react-native')).View,
  Avatar: () => null,
  NameAndHandle: () => null,
}))
jest.mock('#/features/publishers/FollowButton', () => ({
  PublisherFollowButton: (props: object) => {
    const {View} = require('react-native') as typeof import('react-native')
    return <View testID="suggestedFollow" {...props} />
  },
}))
jest.mock('#/components/Layout', () => ({
  Content: (require('react-native') as typeof import('react-native')).View,
}))
jest.mock('#/components/Link', () => ({
  Link: (props: object) => {
    const {View} = require('react-native') as typeof import('react-native')
    return <View testID="seeAllLink" {...props} />
  },
}))
jest.mock('#/components/Loader', () => ({Loader: () => null}))
jest.mock('#/components/Typography', () => ({
  Text: (require('react-native') as typeof import('react-native')).Text,
}))
jest.mock('#/components/Button', () => ({
  Button: (require('react-native') as typeof import('react-native')).View,
  ButtonText: (require('react-native') as typeof import('react-native')).Text,
}))
jest.mock('#/alf', () => ({atoms: new Proxy({}, {get: () => ({})})}))
jest.mock('./Stories', () => ({
  NewsStories: ({publisherDids}: {publisherDids: string[]}) => {
    mockStories(publisherDids)
    const {View} = require('react-native') as typeof import('react-native')
    return <View testID="followingStories" />
  },
}))
beforeEach(() => {
  mockError = false
  mockStories.mockClear()
  mockProfiles = PUBLISHERS.map(publisher => ({
    did: publisher.did,
    handle: publisher.domain,
    displayName: publisher.name,
    viewer: {},
  }))
  i18n.loadAndActivate({locale: 'en', messages: {}})
})
function root() {
  return (
    <I18nProvider i18n={i18n}>
      <FollowingNews header={null} />
    </I18nProvider>
  )
}
it('offers three real publishers and a directory link without fetching the all-publisher feed', () => {
  const view = render(root())
  expect(view.getAllByTestId('suggestedFollow')).toHaveLength(3)
  expect(view.getByTestId('seeAllLink').props.to).toEqual({
    screen: 'PublisherDirectory',
  })
  expect(mockStories).not.toHaveBeenCalled()
})
it('passes only followed publishers to the reader and returns to suggestions after unfollow', () => {
  mockProfiles[1].viewer.following = 'at://follow/one'
  const view = render(root())
  expect(mockStories).toHaveBeenLastCalledWith([PUBLISHERS[1].did])
  expect(view.getByTestId('followingStories')).toBeTruthy()
  mockProfiles = mockProfiles.map(profile => ({...profile, viewer: {}}))
  view.rerender(root())
  expect(view.queryByTestId('followingStories')).toBeNull()
  expect(view.getAllByTestId('suggestedFollow')).toHaveLength(3)
})
it('shows an error rather than claiming the account follows no publishers', () => {
  mockError = true
  const view = render(root())
  expect(view.getByText('Couldn’t load publishers.')).toBeTruthy()
  expect(
    view.queryByText('Follow publishers to see their stories here.'),
  ).toBeNull()
})
