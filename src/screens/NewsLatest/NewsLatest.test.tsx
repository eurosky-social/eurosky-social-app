import {i18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {render, screen} from '@testing-library/react-native'

import {NewsLatestScreen} from './index'

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
jest.mock('#/screens/NewsHome/Stories', () => ({
  NewsStories: ({mode, header}: {mode: string; header: React.ReactNode}) => {
    const {View} = require('react-native') as typeof import('react-native')
    return (
      <View testID="newsStories" accessibilityHint={mode}>
        {header}
      </View>
    )
  },
}))

const mockTitle = jest.fn()

it('titles the page News and shows every story in latest mode', () => {
  i18n.loadAndActivate({locale: 'en', messages: {}})
  render(
    <I18nProvider i18n={i18n}>
      <NewsLatestScreen />
    </I18nProvider>,
  )
  expect(mockTitle).toHaveBeenCalledWith('News')
  expect(screen.getByTestId('pageTitle')).toHaveTextContent('News')
  expect(screen.getByTestId('newsStories').props.accessibilityHint).toBe(
    'latest',
  )
})
