import {render, screen} from '@testing-library/react-native'

import {HomeScreen} from '.'

const mockEnabled = jest.fn()
let mockIsNative = true
let mockMergedFollowing = false
let mockProduct = 'social'

jest.mock('#/config/product', () => ({
  PRODUCT: {
    get id() {
      return mockProduct
    },
  },
}))
jest.mock('#/screens/NewsHome', () => {
  const {Text} = require('react-native') as typeof import('react-native')
  return {NewsHomeScreen: () => <Text>publisher news home</Text>}
})

jest.mock('#/state/queries/preferences', () => ({
  usePreferencesQuery: () => ({
    data: {feedViewPrefs: {lab_mergeFeedEnabled: mockMergedFollowing}},
  }),
}))

jest.mock('#/env', () => ({
  get IS_NATIVE() {
    return mockIsNative
  },
  get IS_WEB() {
    return !mockIsNative
  },
}))

jest.mock('#/analytics', () => ({
  useAnalytics: () => ({
    features: {
      enabled: mockEnabled,
      FollowingV2Enable: 'following_v2:enable',
    },
  }),
}))

jest.mock('#/view/screens/Home', () => {
  const {Text} =
    jest.requireActual<typeof import('react-native')>('react-native')
  return {HomeScreen: () => <Text>legacy home</Text>}
})

jest.mock('./Home', () => {
  const {Text} =
    jest.requireActual<typeof import('react-native')>('react-native')
  return {HomeScreen: () => <Text>following v2 home</Text>}
})

const props = {} as React.ComponentProps<typeof HomeScreen>

describe.each([
  {platform: 'native', isNative: true},
  {platform: 'web', isNative: false},
])('HomeScreen on $platform', ({isNative}) => {
  beforeEach(() => {
    mockEnabled.mockReset()
    mockIsNative = isNative
    mockMergedFollowing = false
    mockProduct = 'social'
  })

  it('always uses the public publisher Home in news, without mounting either social Home', () => {
    mockProduct = 'news'
    mockEnabled.mockReturnValue(true)
    mockMergedFollowing = true
    render(<HomeScreen {...props} />)
    expect(screen.getByText('publisher news home')).toBeTruthy()
    expect(screen.queryByText('legacy home')).toBeNull()
    expect(screen.queryByText('following v2 home')).toBeNull()
    expect(mockEnabled).not.toHaveBeenCalled()
  })

  it('renders the fork when following v2 is enabled', () => {
    mockEnabled.mockReturnValue(true)

    render(<HomeScreen {...props} />)

    expect(mockEnabled).toHaveBeenCalledWith('following_v2:enable')
    expect(screen.getByText('following v2 home')).toBeTruthy()
    expect(screen.queryByText('legacy home')).toBeNull()
  })

  it('keeps the merged following feed on the legacy home', () => {
    mockEnabled.mockReturnValue(true)
    mockMergedFollowing = true

    render(<HomeScreen {...props} />)

    expect(screen.getByText('legacy home')).toBeTruthy()
    expect(screen.queryByText('following v2 home')).toBeNull()
  })

  it('renders the legacy home when following v2 is disabled', () => {
    mockEnabled.mockReturnValue(false)

    render(<HomeScreen {...props} />)

    expect(screen.getByText('legacy home')).toBeTruthy()
    expect(screen.queryByText('following v2 home')).toBeNull()
  })
})
