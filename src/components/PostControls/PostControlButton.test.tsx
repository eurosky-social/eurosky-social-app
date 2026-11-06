import {StyleSheet} from 'react-native'
import {fireEvent, render, screen} from '@testing-library/react-native'

import {type Props as SVGIconProps} from '#/components/icons/common'
import {
  PostControlButton,
  PostControlButtonIcon,
  PostControlButtonProvider,
  PostControlButtonText,
} from './PostControlButton'

jest.mock('#/lib/haptics', () => ({
  useHaptics: () => ({tap: mockTap, longPress: jest.fn()}),
}))
jest.mock('#/alf', () => ({
  atoms: {
    flex_row: {flexDirection: 'row'},
    flex_col: {flexDirection: 'column'},
    align_center: {alignItems: 'center'},
    justify_center: {justifyContent: 'center'},
    bg_transparent: {backgroundColor: 'transparent'},
  },
  web: (style: unknown) => style,
  useTheme: () => ({
    palette: {contrast_500: '#888'},
    atoms: {bg_contrast_25: {backgroundColor: '#222'}},
  }),
}))
jest.mock('#/components/Button', () => ({
  Button: ({children, ...props}: React.PropsWithChildren<object>) => {
    const {View} = require('react-native') as typeof import('react-native')
    return <View {...props}>{children}</View>
  },
}))
jest.mock('#/components/Typography', () => ({
  Text: (require('react-native') as typeof import('react-native')).Text,
}))

const mockTap = jest.fn()
const Icon = jest.fn((_props: SVGIconProps) => null)
function Action({
  active = false,
  vertical = false,
}: {
  active?: boolean
  vertical?: boolean
}) {
  return (
    <PostControlButton
      testID="action"
      label="Like"
      active={active}
      activeColor="#f09"
      style={vertical ? {flexDirection: 'column', gap: 4} : undefined}
      onPress={mockPress}>
      <PostControlButtonIcon icon={Icon} />
      <PostControlButtonText>17</PostControlButtonText>
    </PostControlButton>
  )
}
const mockPress = jest.fn()
beforeEach(() => jest.clearAllMocks())

it('keeps existing feed/thread colors, icon sizes and shape by default', () => {
  render(<Action />)
  expect(screen.getByTestId('action').props.shape).toBe('round')
  expect(screen.getByTestId('action').props.style).toBeUndefined()
  expect(Icon.mock.calls[0][0].width).toBe(18)
  expect(StyleSheet.flatten(Icon.mock.calls[0][0].style)).toMatchObject({
    color: '#888',
  })
  expect(screen.getByText('17')).toHaveStyle({color: '#888'})
})
it('uses a transparent, rectangular overlay target with larger white icons and readable counts', () => {
  render(
    <PostControlButtonProvider presentation="overlay">
      <Action vertical />
    </PostControlButtonProvider>,
  )
  const action = screen.getByTestId('action')
  expect(action.props.shape).toBe('rectangular')
  expect(action).toHaveStyle({
    width: 48,
    minHeight: 48,
    backgroundColor: 'transparent',
    flexDirection: 'column',
    gap: 4,
    borderRadius: 8,
  })
  expect(Icon.mock.calls[0][0].width).toBe(30)
  expect(StyleSheet.flatten(Icon.mock.calls[0][0].style)).toMatchObject({
    color: '#fff',
  })
  expect(screen.getByText('17')).toHaveStyle({
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  })
  fireEvent.press(action)
  expect(mockPress).toHaveBeenCalledTimes(1)
  expect(mockTap).toHaveBeenCalledTimes(1)
})
it('keeps the active heart accent without dimming the count', () => {
  render(
    <PostControlButtonProvider presentation="overlay">
      <Action active />
    </PostControlButtonProvider>,
  )
  expect(StyleSheet.flatten(Icon.mock.calls[0][0].style)).toMatchObject({
    color: '#f09',
  })
  expect(screen.getByText('17')).toHaveStyle({color: '#fff'})
})
