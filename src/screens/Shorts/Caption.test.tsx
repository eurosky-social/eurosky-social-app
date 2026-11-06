import {isValidElement} from 'react'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react-native'

import {ShortsCaption, ShortsFade} from './Caption'

jest.mock('@lingui/react', () => ({
  useLingui: () => ({_: ({message}: {message: string}) => message}),
  Trans: ({message}: {message: string}) => message,
}))
jest.mock('#/alf', () => ({atoms: new Proxy({}, {get: () => ({})})}))
jest.mock('#/components/Button', () => ({
  Button: (require('react-native') as typeof import('react-native')).Pressable,
  ButtonText: (require('react-native') as typeof import('react-native')).Text,
}))
jest.mock('#/components/RichText', () => ({
  RichText: ({value, ...props}: {value: {text: string}}) => {
    const {Text} = require('react-native') as typeof import('react-native')
    return <Text {...props}>{value.text}</Text>
  },
}))
const originalObserver = global.ResizeObserver
const mockDisconnect = jest.fn()
let mockResize = () => {}
let metrics = {scrollHeight: 21, clientHeight: 21}
beforeEach(() => {
  metrics = {scrollHeight: 21, clientHeight: 21}
  mockDisconnect.mockClear()
  global.ResizeObserver = class {
    constructor(callback: ResizeObserverCallback) {
      mockResize = () => callback([], this)
    }
    observe() {}
    unobserve() {}
    disconnect() {
      mockDisconnect()
    }
  }
})
afterAll(() => {
  global.ResizeObserver = originalObserver
})
function caption() {
  return render(
    <ShortsCaption
      value={new RichTextAPI({text: 'Real caption'})}
      authorHandle="wired.com"
    />,
    {
      createNodeMock: element =>
        element.type === 'div' &&
        typeof element.props === 'object' &&
        element.props !== null &&
        'data-testid' in element.props &&
        element.props['data-testid'] === 'shortsCaption'
          ? {querySelector: () => metrics}
          : null,
    },
  )
}
it('uses small regular text without unnecessary controls for a short caption', () => {
  caption()
  expect(screen.getByTestId('shortsCaptionText').props.style).toEqual([
    {color: '#fff', fontSize: 14, lineHeight: 21},
  ])
  expect(screen.getByTestId('shortsCaptionText').props.numberOfLines).toBe(3)
  expect(screen.queryByTestId('shortsCaptionToggle')).toBeNull()
})
it('lets the reader expand and collapse a clipped caption', () => {
  metrics = {scrollHeight: 126, clientHeight: 63}
  caption()
  fireEvent.press(screen.getByTestId('shortsCaptionToggle'))
  expect(
    screen.getByTestId('shortsCaptionText').props.numberOfLines,
  ).toBeUndefined()
  expect(screen.getByText('Less')).toBeTruthy()
  fireEvent.press(screen.getByTestId('shortsCaptionToggle'))
  expect(screen.getByTestId('shortsCaptionText').props.numberOfLines).toBe(3)
  expect(screen.getByText('More')).toBeTruthy()
})
it('remeasures clipping on resize and cleans up its observer', () => {
  const view = caption()
  act(() => {
    metrics.scrollHeight = 84
    mockResize()
  })
  expect(screen.getByText('More')).toBeTruthy()
  view.unmount()
  expect(mockDisconnect).toHaveBeenCalled()
})
it('extends the fade to the bottom without capturing input', () => {
  const {result} = renderHook(() => ShortsFade())
  function style(node: React.ReactNode) {
    if (!isValidElement<{style: React.CSSProperties}>(node))
      throw new Error('Expected a fade element')
    return node.props.style
  }
  expect(style(result.current)).toMatchObject({
    inset: '35% 0 0',
    pointerEvents: 'none',
  })
})
