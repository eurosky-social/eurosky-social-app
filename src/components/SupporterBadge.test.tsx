import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {fireEvent, render} from '@testing-library/react-native'

import {SupporterBadge} from './SupporterBadge'

jest.mock('#/config/brand', () => ({BRAND: {name: 'Mu'}}))
jest.mock('#/alf', () => ({useTheme: () => ({palette: {pink: '#db2777'}})}))
jest.mock('#/components/icons/Heart2', () => ({
  Heart2_Filled_Stroke2_Corner0_Rounded: () => null,
}))
jest.mock('#/components/Tooltip', () => {
  const React = require('react') as typeof import('react')
  const {Text} = require('react-native') as typeof import('react-native')
  const Context = React.createContext(false)
  return {
    Outer: ({
      children,
      visible,
    }: {
      children: React.ReactNode
      visible: boolean
    }) => React.createElement(Context.Provider, {value: visible}, children),
    Target: ({children}: {children: React.ReactNode}) => children,
    BubbleText: ({children}: {children: React.ReactNode}) =>
      React.useContext(Context)
        ? React.createElement(Text, {}, children)
        : null,
  }
})

const i18n = setupI18n({locale: 'en', messages: {en: {}}})
function wrapper({children}: {children: React.ReactNode}) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

it('labels the static heart as a supporter badge, not verification', () => {
  const screen = render(<SupporterBadge width={14} />, {wrapper})
  expect(screen.getByRole('image', {name: 'Mu supporter'})).toBeTruthy()
  expect(screen.queryByRole('button')).toBeNull()
})

it('explains the badge without activating a surrounding profile link', () => {
  const screen = render(<SupporterBadge width={18} interactive />, {wrapper})
  const event = {preventDefault: jest.fn(), stopPropagation: jest.fn()}
  fireEvent.press(screen.getByRole('button', {name: 'Mu supporter'}), event)
  expect(event.preventDefault).toHaveBeenCalled()
  expect(event.stopPropagation).toHaveBeenCalled()
  expect(
    screen.getByText('Supports Mu. This is not identity verification.'),
  ).toBeTruthy()
})
