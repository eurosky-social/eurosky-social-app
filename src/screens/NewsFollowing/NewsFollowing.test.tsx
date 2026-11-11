import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {render, screen} from '@testing-library/react-native'

import {NewsFollowingScreen} from './index'

jest.mock('#/lib/hooks/useSetTitle', () => ({
  useSetTitle: (title: string) => mockTitle(title),
}))
jest.mock('#/components/Layout', () => {
  const {View, Text} = require('react-native') as typeof import('react-native')
  const pass = ({children}: React.PropsWithChildren<{}>) => (
    <View>{children}</View>
  )
  return {
    Screen: pass,
    Header: {
      Outer: pass,
      Content: pass,
      Slot: pass,
      MenuButton: () => null,
      TitleText: ({children}: React.PropsWithChildren<{}>) => (
        <Text testID="pageTitle">{children}</Text>
      ),
    },
  }
})
jest.mock('#/screens/NewsHome/Following', () => ({
  FollowingNews: ({header}: {header: React.ReactNode}) => {
    const {View} = require('react-native') as typeof import('react-native')
    return <View testID="followingNews">{header}</View>
  },
}))

const mockTitle = jest.fn()

it('titles the page Following and shows the followed publishers', () => {
  i18n.loadAndActivate({locale: 'en', messages: {}})
  render(
    <I18nProvider i18n={i18n}>
      <NewsFollowingScreen />
    </I18nProvider>,
  )
  expect(mockTitle).toHaveBeenCalledWith('Following')
  expect(screen.getByTestId('pageTitle')).toHaveTextContent('Following')
  expect(screen.getByTestId('followingNews')).toBeTruthy()
})
