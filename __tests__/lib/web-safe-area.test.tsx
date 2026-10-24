import {View} from 'react-native'
import {NativeSafeAreaProvider} from 'react-native-safe-area-context/src/NativeSafeAreaProvider.web'
import {act, render} from '@testing-library/react-native'
import {JSDOM} from 'jsdom'

/* Give the web provider a DOM ref instead of a native test-renderer ref. */
jest.mock('react-native', () => {
  const React = jest.requireActual('react')
  return Object.defineProperty(
    Object.create(jest.requireActual('react-native')),
    'View',
    {
      value: React.forwardRef((props: object, ref: React.Ref<unknown>) =>
        React.createElement('View', {...props, ref}),
      ),
    },
  )
})

const dom = new JSDOM('<!doctype html><html><body></body></html>')
let onResize: (() => void) | undefined
const disconnect = jest.fn()
const domGlobals = {
  window: dom.window,
  document: dom.window.document,
  ResizeObserver: class {
    constructor(callback: () => void) {
      onResize = callback
    }
    observe() {}
    disconnect = disconnect
  },
}
const originalGlobals = Object.keys(domGlobals).map(
  key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
)

beforeAll(() => {
  for (const [key, value] of Object.entries(domGlobals)) {
    Object.defineProperty(globalThis, key, {value, configurable: true})
  }
})
afterAll(() => {
  for (const [key, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor)
    else Reflect.deleteProperty(globalThis, key)
  }
  dom.window.close()
})
beforeEach(() => {
  jest.clearAllMocks()
})
afterEach(() => {
  jest.restoreAllMocks()
  onResize = undefined
})

function mountProvider(insets = {top: 0, bottom: 0, left: 0, right: 0}) {
  jest.spyOn(window, 'getComputedStyle').mockReturnValue({
    paddingTop: `${insets.top}px`,
    paddingBottom: `${insets.bottom}px`,
    paddingLeft: `${insets.left}px`,
    paddingRight: `${insets.right}px`,
  } as CSSStyleDeclaration)
  const node = document.createElement('div')
  let rect = {
    top: 0,
    left: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  }
  jest.spyOn(node, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        ...rect,
        x: rect.left,
        y: rect.top,
        width: rect.right - rect.left,
        height: rect.bottom - rect.top,
      }) as DOMRect,
  )
  const onInsetsChange = jest.fn()
  const view = render(
    <NativeSafeAreaProvider onInsetsChange={onInsetsChange}>
      <View />
    </NativeSafeAreaProvider>,
    {createNodeMock: () => node},
  )
  return {
    ...view,
    onInsetsChange,
    resize(nextRect: Partial<typeof rect>, useObserver = false) {
      rect = {...rect, ...nextRect}
      act(() => {
        if (useObserver) onResize?.()
        else window.dispatchEvent(new dom.window.Event('resize'))
      })
    },
    insets: () => onInsetsChange.mock.lastCall?.[0].nativeEvent.insets,
  }
}

it('does not turn a scrolled page offset into padding when Safari resizes', () => {
  const provider = mountProvider()
  expect(provider.insets()).toEqual({top: 0, bottom: 0, left: 0, right: 0})

  provider.resize({top: -4500, bottom: window.innerHeight - 4500})
  expect(provider.insets()).toEqual({top: 0, bottom: 0, left: 0, right: 0})
  expect(provider.onInsetsChange.mock.lastCall?.[0].nativeEvent.frame.y).toBe(
    -4500,
  )
})

it('keeps real notch insets bounded when the provider extends past the viewport', () => {
  const provider = mountProvider({top: 59, bottom: 34, left: 20, right: 20})
  provider.resize(
    {
      top: -4500,
      bottom: window.innerHeight + 4500,
      left: -100,
      right: window.innerWidth + 100,
    },
    true,
  )
  expect(provider.insets()).toEqual({top: 59, bottom: 34, left: 20, right: 20})
})

it('still reduces insets for providers contained within the viewport', () => {
  const provider = mountProvider({top: 59, bottom: 34, left: 20, right: 20})
  provider.resize({
    top: 10,
    bottom: window.innerHeight - 10,
    left: 5,
    right: window.innerWidth - 5,
  })
  expect(provider.insets()).toEqual({top: 49, bottom: 24, left: 15, right: 15})
  provider.resize({
    top: 100,
    bottom: window.innerHeight - 100,
    left: 100,
    right: window.innerWidth - 100,
  })
  expect(provider.insets()).toEqual({top: 0, bottom: 0, left: 0, right: 0})
})

it('removes its measurement element and observer when unmounted', () => {
  const before = document.body.childElementCount
  const provider = mountProvider()
  expect(document.body.childElementCount).toBe(before + 1)
  provider.unmount()
  expect(document.body.childElementCount).toBe(before)
  expect(disconnect).toHaveBeenCalled()
})
