import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {act, fireEvent, render} from '@testing-library/react-native'

import {type app} from '#/lexicons'
import {PublisherFollowButton} from './FollowButton'

jest.mock('#/state/session', () => ({useSession: () => mockSession}))
jest.mock('#/state/cache/profile-shadow', () => ({
  useProfileShadow: (value: unknown) => value,
}))
jest.mock('#/state/queries/profile', () => ({
  useProfileFollowMutationQueue: () => [mockFollow, mockUnfollow],
}))
jest.mock('@bsky/sdk/moderation', () => ({
  moderateProfile: () => ({ui: () => ({blurs: []})}),
}))
jest.mock('#/lib/moderation', () => ({}))
jest.mock('#/view/com/util/UserAvatar', () => ({}))
jest.mock('#/features/liveNow', () => ({}))
jest.mock('#/alf', () => ({atoms: {}, useTheme: () => ({atoms: {}})}))
jest.mock('#/components/Button', () => {
  const {Pressable, Text} =
    require('react-native') as typeof import('react-native')
  return {Button: Pressable, ButtonText: Text, ButtonIcon: () => null}
})
jest.mock('#/components/Link', () => ({}))
jest.mock('#/components/Pills', () => ({}))
jest.mock('#/components/ProfileBadges', () => ({}))
jest.mock('#/components/RichText', () => ({}))
jest.mock('#/components/Typography', () => ({}))
jest.mock('#/components/Toast', () => ({show: jest.fn()}))

const mockFollow = jest.fn(() => Promise.resolve())
const mockUnfollow = jest.fn(() => Promise.resolve())
let mockSession = {hasSession: true, currentAccount: {did: 'did:plc:reader'}}
const opts = {} as React.ComponentProps<
  typeof PublisherFollowButton
>['moderationOpts']
function profile(viewer: Record<string, unknown> = {}) {
  return {
    did: 'did:plc:publisher',
    handle: 'publisher.test',
    viewer,
  } as app.bsky.actor.defs.ProfileViewDetailed
}
function root(content: React.ReactNode) {
  return <I18nProvider i18n={i18n}>{content}</I18nProvider>
}
beforeEach(() => {
  jest.clearAllMocks()
  i18n.loadAndActivate({locale: 'en', messages: {}})
  mockSession = {hasSession: true, currentAccount: {did: 'did:plc:reader'}}
})
it('uses Follow and Following with the existing follow/unfollow actions', async () => {
  const screen = render(
    root(<PublisherFollowButton profile={profile()} moderationOpts={opts} />),
  )
  expect(screen.queryByText('Subscribe')).toBeNull()
  await act(async () => {
    fireEvent.press(screen.getByText('Follow'), {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    })
    await Promise.resolve()
  })
  expect(mockFollow).toHaveBeenCalledTimes(1)
  expect(mockUnfollow).not.toHaveBeenCalled()
  screen.rerender(
    root(
      <PublisherFollowButton
        profile={profile({following: 'at://following'})}
        moderationOpts={opts}
      />,
    ),
  )
  expect(screen.getByText('Following')).toBeTruthy()
  await act(async () => {
    fireEvent.press(screen.getByText('Following'), {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    })
    await Promise.resolve()
  })
  expect(mockUnfollow).toHaveBeenCalledTimes(1)
})
it.each([
  {blocking: 'at://block'},
  {blockedBy: true},
  {blockingByList: {uri: 'at://list', name: 'Blocked publishers'}},
])('retains blocked-account restrictions %j', viewer => {
  const screen = render(
    root(
      <PublisherFollowButton profile={profile(viewer)} moderationOpts={opts} />,
    ),
  )
  expect(screen.queryByText('Follow')).toBeNull()
  expect(mockFollow).not.toHaveBeenCalled()
})
it('retains signed-out and self restrictions', () => {
  mockSession.hasSession = false
  const screen = render(
    root(<PublisherFollowButton profile={profile()} moderationOpts={opts} />),
  )
  expect(screen.queryByText('Follow')).toBeNull()
  mockSession = {hasSession: true, currentAccount: {did: 'did:plc:publisher'}}
  screen.rerender(
    root(<PublisherFollowButton profile={profile()} moderationOpts={opts} />),
  )
  expect(screen.queryByText('Follow')).toBeNull()
})
it('retains the usual Follow back state', () => {
  const screen = render(
    root(
      <PublisherFollowButton
        profile={profile({followedBy: 'at://follow-back'})}
        moderationOpts={opts}
      />,
    ),
  )
  expect(screen.getByText('Follow back')).toBeTruthy()
})
