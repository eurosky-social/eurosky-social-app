import {render, screen} from '@testing-library/react-native'

import type * as bsky from '#/types/bsky'
import {StarterPackPeople} from './StarterPackPeople'

jest.mock('@lingui/react', () => ({
  useLingui: () => ({
    _: ({
      message,
      values,
    }: {
      message: string
      values?: Record<string, string | number>
    }) =>
      message.replace(/\{(\w+)\}/g, (_, key: string) =>
        String(values?.[key] ?? ''),
      ),
    i18n: {number: String},
  }),
  Trans: ({message}: {message: string}) => message,
}))
jest.mock('@bsky/sdk/moderation', () => ({
  moderateProfile: () => ({ui: () => ({filter: false})}),
}))
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({data: undefined, isFetching: false, isError: false}),
}))
jest.mock('#/state/preferences/moderation-opts', () => ({
  useModerationOpts: () => ({}),
}))
jest.mock('#/state/session', () => ({
  useAppviewClient: () => ({}),
  useSession: () => ({}),
}))
jest.mock('#/alf', () => ({
  atoms: new Proxy({}, {get: () => ({})}),
  useTheme: () => ({atoms: {}}),
}))
jest.mock('#/components/Link', () => ({
  Link: (require('react-native') as typeof import('react-native')).View,
}))
jest.mock('#/components/Button', () => ({
  Button: (require('react-native') as typeof import('react-native')).View,
  ButtonText: (require('react-native') as typeof import('react-native')).Text,
}))
jest.mock('#/components/Loader', () => ({Loader: () => null}))
jest.mock('#/components/Typography', () => ({
  Text: (require('react-native') as typeof import('react-native')).Text,
}))
jest.mock('#/components/moderation/ContentHider', () => ({
  ContentHider: ({children}: {children: React.ReactNode}) => children,
}))
jest.mock('#/components/StarterPack/StarterPackCard', () => ({
  useStarterPackLink: () => ({
    to: '/starter-pack/did:plc:owner/demo',
    label: 'Open starter pack',
    precache: () => {},
  }),
}))
jest.mock('#/components/ProfileCard', () => {
  const {createElement} = require('react') as typeof import('react')
  const {View, Text} = require('react-native') as typeof import('react-native')
  return {
    Link: View,
    Avatar: () => null,
    NameAndHandle: ({profile}: {profile: {handle: string}}) =>
      createElement(Text, {}, profile.handle),
  }
})

function pack(count: number): bsky.starterPack.AnyStarterPackView {
  return {
    uri: 'at://did:plc:owner/app.bsky.graph.starterpack/demo',
    cid: 'bafytest',
    creator: {did: 'did:plc:owner', handle: 'owner.example'},
    indexedAt: '2026-07-15T12:00:00Z',
    record: {
      $type: 'app.bsky.graph.starterpack',
      name: 'Newsroom',
      list: 'at://did:plc:owner/app.bsky.graph.list/demo',
      createdAt: '2026-07-15T12:00:00Z',
    },
    list: {
      uri: 'at://did:plc:owner/app.bsky.graph.list/demo',
      cid: 'bafylist',
      name: 'Newsroom',
      purpose: 'app.bsky.graph.defs#referencelist',
      listItemCount: count,
    },
    listItemsSample: Array.from({length: Math.min(12, count)}, (_, i) => ({
      uri: `at://did:plc:owner/app.bsky.graph.listitem/${i}` as const,
      subject: {
        did: `did:plc:member${i}` as const,
        handle: `member${i}.example`,
      },
    })),
  }
}

it('shows six people and the real remaining member count, not the sample count', () => {
  render(<StarterPackPeople pack={pack(100)} />)
  expect(screen.getAllByTestId('starterPackPerson')).toHaveLength(6)
  expect(screen.getByText('94 more')).toBeTruthy()
  expect(screen.getByTestId('starterPackMorePeople').props.to).toBe(
    '/starter-pack/did:plc:owner/demo',
  )
})
it.each([1, 6])(
  'does not add a more button for a pack with %s members',
  count => {
    render(<StarterPackPeople pack={pack(count)} />)
    expect(screen.getAllByTestId('starterPackPerson')).toHaveLength(count)
    expect(screen.queryByTestId('starterPackMorePeople')).toBeNull()
  },
)
it('does not offer opted-out members as extra people', () => {
  const source = pack(7)
  if ('listItemsSample' in source && source.listItemsSample)
    source.listItemsSample[6].subjectOptedOut = true
  render(<StarterPackPeople pack={source} />)
  expect(screen.getAllByTestId('starterPackPerson')).toHaveLength(6)
  expect(screen.queryByTestId('starterPackMorePeople')).toBeNull()
})
