import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {render} from '@testing-library/react-native'

import {NewsHomeScreen} from './index'

jest.mock('react-native-reanimated', () => ({
  useSharedValue: (value: unknown) => ({value, set: jest.fn()}),
}))
let mockSignedIn = false
jest.mock('#/state/session', () => ({
  useSession: () => ({hasSession: mockSignedIn}),
}))
jest.mock('#/lib/hooks/useSetTitle', () => ({useSetTitle: () => {}}))
jest.mock('#/components/Layout', () => ({
  Screen: (require('react-native') as typeof import('react-native')).View,
}))
jest.mock('#/view/com/pager/TabBar', () => ({
  TabBar: (require('react-native') as typeof import('react-native')).View,
}))
jest.mock('./Stories', () => ({
  NewsStories: ({header}: {header?: React.ReactNode}) => {
    const {View} = require('react-native') as typeof import('react-native')
    return <View testID="discoverReader">{header}</View>
  },
}))
// Preserve the actual header in the Following stub so selection follows the real parent state.
jest.mock('./Following', () => ({
  FollowingNews: ({header}: {header: React.ReactNode}) => {
    const {View} = require('react-native') as typeof import('react-native')
    return <View testID="followingReader">{header}</View>
  },
}))
beforeEach(() => {
  mockSignedIn = false
  i18n.loadAndActivate({locale: 'en', messages: {}})
})
function root() {
  return (
    <I18nProvider i18n={i18n}>
      <NewsHomeScreen />
    </I18nProvider>
  )
}
it('keeps signed-out Home public without Following tabs or the follow graph reader', () => {
  const view = render(root())
  expect(view.getByTestId('discoverReader')).toBeTruthy()
  expect(view.queryByTestId('followingReader')).toBeNull()
  expect(view.queryByTestId('newsFeedTabs')).toBeNull()
})
it('shows Discover without Following tabs, signed in or out', () => {
  mockSignedIn = true
  const view = render(root())
  expect(view.getByTestId('discoverReader')).toBeTruthy()
  expect(view.queryByTestId('followingReader')).toBeNull()
  expect(view.queryByTestId('newsFeedTabs')).toBeNull()
})
