import {Children, isValidElement} from 'react'
import {renderHook} from '@testing-library/react-native'

import {ArticleGrid} from './index.web'

jest.mock('#/alf', () => ({
  useTheme: () => ({atoms: {border_contrast_low: {borderColor: '#333'}}}),
}))
function element(node: React.ReactNode) {
  if (
    !isValidElement<{
      children?: React.ReactNode
      style?: React.CSSProperties
      'data-story'?: number
    }>(node)
  )
    throw new Error('Expected an element')
  return node
}
function order(node: React.ReactNode): number[] {
  return Children.toArray(node).flatMap(child => {
    if (
      !isValidElement<{children?: React.ReactNode; 'data-story'?: number}>(
        child,
      )
    )
      return []
    return child.props['data-story'] === undefined
      ? order(child.props.children)
      : [child.props['data-story']]
  })
}
it('renders two small left stories before the right feature in DOM order, with the rule on the correct side', () => {
  const {result} = renderHook(() =>
    ArticleGrid({
      wide: true,
      sizes: ['small', 'small', 'medium'],
      children: [0, 1, 2].map(index => <span key={index} data-story={index} />),
    }),
  )
  expect(order(result.current)).toEqual([0, 1, 2])
  const band = element(
    Children.toArray(element(result.current).props.children)[0],
  )
  expect(band.props.style?.gridTemplateColumns).toBe(
    'minmax(0, 1fr) minmax(0, 2fr)',
  )
  const aside = element(
    Children.toArray(element(band.props.children).props.children)[0],
  )
  expect(order(aside)).toEqual([0, 1])
  expect(aside.props.style?.borderRight).toBe('1px solid #333')
  expect(aside.props.style?.borderLeft).toBeUndefined()
})
