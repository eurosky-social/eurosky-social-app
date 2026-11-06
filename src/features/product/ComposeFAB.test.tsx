import {render} from '@testing-library/react-native'

import {getProduct, PRODUCT} from '#/config/product'
import {ComposeFAB} from './ComposeFAB'

jest.mock('#/config/product', () => {
  const actual = jest.requireActual<{getProduct: typeof getProduct}>(
    '#/config/product',
  )
  return {...actual, PRODUCT: actual.getProduct('social')}
})
jest.mock('#/view/com/util/fab/FAB', () => {
  const {View} = require('react-native')
  return {FAB: (props: object) => <View {...props} />}
})

afterEach(() => jest.restoreAllMocks())

it('retains the shared platform FAB in social', () => {
  const screen = render(
    <ComposeFAB
      testID="composeFAB"
      onPress={jest.fn()}
      icon={<></>}
      accessibilityLabel="New post"
      accessibilityHint=""
      accessibilityRole="button"
    />,
  )
  expect(screen.getByTestId('composeFAB')).toBeTruthy()
})

it('removes standalone compose FABs in news', () => {
  jest.replaceProperty(PRODUCT, 'capabilities', getProduct('news').capabilities)
  const screen = render(
    <ComposeFAB
      testID="composeFAB"
      onPress={jest.fn()}
      icon={<></>}
      accessibilityLabel="New post"
      accessibilityHint=""
      accessibilityRole="button"
    />,
  )
  expect(screen.queryByTestId('composeFAB')).toBeNull()
})
