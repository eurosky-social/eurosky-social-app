import {render, screen} from '@testing-library/react-native'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import * as ProfileCard from '#/components/ProfileCard'
import {PublisherByline} from './Byline'
import {PUBLISHERS} from './publishers'

jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: jest.fn(() => ({})),
}))
jest.mock('#/alf', () => ({
  atoms: new Proxy({}, {get: () => ({})}),
  useTheme: () => mockTheme,
}))
jest.mock('#/components/Link', () => ({
  Link: (require('react-native') as typeof import('react-native')).View,
}))
jest.mock('#/components/Typography', () => ({
  Text: (require('react-native') as typeof import('react-native')).Text,
}))
jest.mock('#/components/ProfileCard', () => ({Avatar: jest.fn(() => null)}))

const mockTheme = {
  name: 'light',
  atoms: {
    bg_contrast_25: {backgroundColor: '#111'},
    bg_contrast_100: {backgroundColor: '#444'},
  },
}
beforeEach(() => {
  mockTheme.name = 'light'
})
const profile = {
  did: PUBLISHERS[0].did,
  handle: PUBLISHERS[0].domain,
  avatar: 'https://example.com/real-avatar.jpg',
} as const

it('links a named source badge to its Publisher page and passes the real profile through avatar moderation', () => {
  render(<PublisherByline profile={profile} />)
  expect(screen.getByTestId('publisherByline').props.to).toEqual({
    screen: 'Publisher',
    params: {publisher: PUBLISHERS[0].id},
  })
  expect(screen.getByText(PUBLISHERS[0].name)).toBeTruthy()
  expect(jest.mocked(ProfileCard.Avatar).mock.calls[0][0]).toMatchObject({
    profile,
    moderationOpts: {},
    disabledPreview: true,
    size: 22,
  })
})
it('uses a lighter badge surface only in dim mode', () => {
  mockTheme.name = 'dim'
  const {rerender} = render(<PublisherByline profile={profile} />)
  expect(screen.getByTestId('publisherByline').props.style).toContainEqual(
    mockTheme.atoms.bg_contrast_100,
  )
  mockTheme.name = 'dark'
  rerender(<PublisherByline profile={profile} />)
  expect(screen.getByTestId('publisherByline').props.style).toContainEqual(
    mockTheme.atoms.bg_contrast_25,
  )
})
it('does not render an unknown organisation or an unmoderated avatar', () => {
  const {rerender} = render(
    <PublisherByline profile={{...profile, did: 'did:plc:unknown'}} />,
  )
  expect(screen.toJSON()).toBeNull()
  jest.mocked(useModerationOpts).mockReturnValueOnce(undefined)
  rerender(<PublisherByline profile={profile} />)
  expect(screen.toJSON()).toBeNull()
})
