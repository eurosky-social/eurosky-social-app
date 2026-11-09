import {render, screen} from '@testing-library/react-native'

import {NewsroomScreen} from './NewsroomScreen'
import {NEWSROOM_PUBLISHERS} from './publishers'

jest.mock('@lingui/react', () => ({
  useLingui: () => ({_: ({message}: {message: string}) => message}),
  Trans: ({message}: {message: string}) => message,
}))
jest.mock('#/alf', () => ({
  atoms: new Proxy({}, {get: () => ({})}),
  useTheme: () => ({atoms: {}, palette: {primary_500: '#00f'}}),
  useLayoutBreakpoints: () => ({rightNavVisible: mockRightNavVisible}),
}))
jest.mock('#/state/queries/profile', () => ({
  useProfileQuery: () => ({data: mockNamedProfile, isLoading: false}),
  useProfilesQuery: () => ({data: {profiles: []}}),
}))
jest.mock('#/components/Layout', () => {
  const {View} = require('react-native') as typeof import('react-native')
  return {
    Screen: View,
    Center: View,
    Header: {
      Outer: View,
      BackButton: () => null,
      Content: View,
      TitleText: (require('react-native') as typeof import('react-native'))
        .Text,
      Slot: View,
    },
  }
})
jest.mock('#/components/Button', () => {
  const {Pressable, Text} =
    require('react-native') as typeof import('react-native')
  return {Button: Pressable, ButtonText: Text, ButtonIcon: () => null}
})
jest.mock('#/components/Link', () => ({
  Link: (require('react-native') as typeof import('react-native')).View,
}))
jest.mock('#/components/Menu', () => {
  const {View} = require('react-native') as typeof import('react-native')
  return {Root: View, Trigger: () => null, Outer: () => null}
})
jest.mock('#/components/Loader', () => ({Loader: () => null}))
jest.mock('#/components/Typography', () => ({
  Text: (require('react-native') as typeof import('react-native')).Text,
}))
jest.mock('#/view/com/util/UserAvatar', () => ({UserAvatar: () => null}))
jest.mock('#/view/com/posts/PostFeed', () => ({
  PostFeed: (props: {feed: string; ListHeaderComponent: React.ReactNode}) => {
    mockPostFeed(props)
    return props.ListHeaderComponent
  },
}))
jest.mock('./NewsroomMasthead', () => ({
  NewsroomMasthead: () => {
    const {Text} = require('react-native') as typeof import('react-native')
    return <Text>Original masthead</Text>
  },
}))
jest.mock('./NewsroomFrontPage', () => ({
  NewsroomFrontPage: () => {
    const {Text} = require('react-native') as typeof import('react-native')
    return <Text>Original RSS articles</Text>
  },
}))
jest.mock('./NewsroomRightRail', () => ({
  NewsroomRightRail: () => {
    const {Text} = require('react-native') as typeof import('react-native')
    return <Text>Original newsroom rail</Text>
  },
}))
jest.mock('./NewsroomSwitcher', () => ({NewsroomSwitcher: () => null}))
jest.mock('../PublicationScreen', () => {
  throw new Error('News v1 must not load the editorial publication screen')
})

let mockRightNavVisible = true
let mockNamedProfile: {did: string} | undefined
const mockPostFeed = jest.fn<
  void,
  [{feed: string; ListHeaderComponent: React.ReactNode}]
>()
const publisher = NEWSROOM_PUBLISHERS[0]

function renderNewsroom(name?: string) {
  const setParams = jest.fn()
  const props = {
    route: {params: {name}},
    navigation: {setParams},
  } as unknown as React.ComponentProps<typeof NewsroomScreen>
  const result = render(<NewsroomScreen {...props} />)
  return {...result, setParams}
}

beforeEach(() => {
  jest.clearAllMocks()
  mockRightNavVisible = true
  mockNamedProfile = undefined
})

it.each([undefined, publisher.did, publisher.id])(
  'keeps the original masthead, RSS articles and conversation for %s',
  name => {
    const {setParams} = renderNewsroom(name)
    expect(screen.getByTestId('newsroomScreen')).toBeTruthy()
    expect(screen.getByText('Original masthead')).toBeTruthy()
    expect(screen.getByText('Original RSS articles')).toBeTruthy()
    expect(screen.queryByText('Edit front page')).toBeNull()
    expect(mockPostFeed.mock.calls[0][0].feed).toBe(
      `frontpage|${[publisher.did, ...publisher.reporterDids].join(',')}`,
    )
    if (name !== publisher.did) {
      expect(setParams).toHaveBeenCalledWith({name: publisher.did})
    }
  },
)

it('resolves a publisher handle without falling back to the default publisher', () => {
  const other = NEWSROOM_PUBLISHERS[1]
  mockNamedProfile = {did: other.did}
  const {setParams} = renderNewsroom('publisher.example')
  expect(setParams).toHaveBeenCalledWith({name: other.did})
  expect(mockPostFeed.mock.calls[0][0].feed).toContain(other.did)
})

it('only renders the inline contextual rail when the desktop rail is hidden', () => {
  const {unmount} = renderNewsroom()
  expect(screen.queryByText('Original newsroom rail')).toBeNull()
  unmount()
  mockRightNavVisible = false
  renderNewsroom()
  expect(screen.getByText('Original newsroom rail')).toBeTruthy()
})
