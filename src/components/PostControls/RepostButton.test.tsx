import {fireEvent, render} from '@testing-library/react-native'

import {getProduct, PRODUCT} from '#/config/product'
import * as env from '#/env'
import {RepostButton, RepostButtonDialogInner} from './RepostButton'

jest.mock('#/config/product', () => {
  const actual = jest.requireActual<{getProduct: typeof getProduct}>(
    '#/config/product',
  )
  return {...actual, PRODUCT: actual.getProduct('social')}
})
jest.mock('#/env', () => ({__esModule: true, IS_IPAD: false}))
jest.mock('#/lib/haptics', () => ({
  useHaptics: () => ({longPress: jest.fn(), confirm: jest.fn()}),
}))
jest.mock('#/components/PostControls/RepostButtonMenu', () => {
  const {View} = require('react-native')

  return {
    RepostButtonMenu: ({longPressToQuote}: {longPressToQuote?: boolean}) => (
      <View
        testID={longPressToQuote ? 'ipad-repost-menu' : 'web-repost-menu'}
      />
    ),
  }
})
jest.mock('#/components/Dialog', () => {
  const {View} = require('react-native')

  return {
    Outer: () => <View testID="phone-repost-dialog" />,
    Handle: () => null,
    ScrollableInner: ({children}: React.PropsWithChildren) => (
      <View>{children}</View>
    ),
    useDialogContext: () => ({close: (callback?: () => void) => callback?.()}),
    useDialogControl: () => ({open: jest.fn(), close: jest.fn()}),
  }
})
jest.mock('#/components/PostControls/PostControlButton', () => {
  const {View} = require('react-native')

  return {
    PostControlButton: (props: object) => (
      <View testID="repostBtn" {...props} />
    ),
    PostControlButtonIcon: () => null,
    PostControlButtonText: () => null,
  }
})
jest.mock('#/components/PostControls/util', () => ({
  useFormatPostStatCount: () => String,
}))
jest.mock('#/state/session', () => ({
  useRequireAuth: () => (callback: () => void) => callback(),
}))
jest.mock('#/alf', () => ({
  atoms: {},
  useTheme: () => ({palette: {positive_500: 'green'}, atoms: {}}),
}))
jest.mock('@lingui/react', () => ({
  useLingui: () => ({_: () => ''}),
  Trans: () => null,
}))

jest.mock('#/components/Button', () => {
  const {Pressable, Text} = require('react-native')
  return {
    Button: ({
      label,
      onPress,
      testID,
      children,
    }: React.PropsWithChildren<{
      label: string
      onPress: () => void
      testID?: string
    }>) => (
      <Pressable
        accessibilityLabel={label}
        accessibilityHint=""
        onPress={onPress}
        testID={testID}>
        {children}
      </Pressable>
    ),
    ButtonText: Text,
  }
})
jest.mock('#/components/Typography', () => {
  const {Text} = require('react-native')
  return {Text}
})

const props = {
  isReposted: false,
  repostCount: 1,
  onRepost: jest.fn(),
  onQuote: jest.fn(),
  embeddingDisabled: false,
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('native repost button selection', () => {
  it('does not quote on long press in news', () => {
    jest.replaceProperty(
      PRODUCT,
      'capabilities',
      getProduct('news').capabilities,
    )
    const onQuote = jest.fn()
    const screen = render(<RepostButton {...props} onQuote={onQuote} />)
    fireEvent(screen.getByTestId('repostBtn'), 'longPress')
    expect(onQuote).not.toHaveBeenCalled()
  })

  it('removes the native quote action while retaining repost in news', () => {
    jest.replaceProperty(
      PRODUCT,
      'capabilities',
      getProduct('news').capabilities,
    )
    const screen = render(<RepostButtonDialogInner {...props} />)
    expect(screen.queryByTestId('quoteBtn')).toBeNull()
    expect(screen.toJSON()).not.toBeNull()
  })

  it('uses the menu on iPad', () => {
    jest.replaceProperty(env, 'IS_IPAD', true)

    const screen = render(<RepostButton {...props} />)

    expect(screen.getByTestId('ipad-repost-menu')).toBeTruthy()
    expect(screen.queryByTestId('phone-repost-dialog')).toBeNull()
  })

  it('keeps the dialog on iPhone and other non-iPad devices', () => {
    jest.replaceProperty(env, 'IS_IPAD', false)

    const screen = render(<RepostButton {...props} />)

    expect(screen.getByTestId('phone-repost-dialog')).toBeTruthy()
    expect(screen.queryByTestId('ipad-repost-menu')).toBeNull()
  })
})
