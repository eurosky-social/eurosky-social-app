import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {renderHook} from '@testing-library/react-native'

import {getCandyColor} from './candy'
import {CandyIcon} from './CandyIcon'
import {useLikePresentation} from './useLikePresentation'

let mockActive = true
const pink = '#EC4899'
const uri = 'at://did:plc:alice/app.bsky.feed.post/3kabc'

jest.mock('#/features/halloween/context', () => ({
  useHalloween: () => ({isActive: mockActive}),
}))
jest.mock('#/alf', () => ({
  useTheme: () => ({palette: {pink: '#EC4899'}}),
}))

const i18n = setupI18n({locale: 'en', messages: {en: {}}})
function Wrapper({children}: React.PropsWithChildren<{}>) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

beforeEach(() => {
  mockActive = true
})

it.each([
  [false, 0, 'Give candy (0 candies)'],
  [false, 1, 'Give candy (1 candy)'],
  [true, 2, 'Take back candy (2 candies)'],
])(
  'provides the candy action for liked=%s, count=%s',
  (isLiked, likeCount, label) => {
    const {result} = renderHook(
      () => useLikePresentation({uri, isLiked, likeCount}),
      {wrapper: Wrapper},
    )
    expect(result.current.label).toBe(label)
    expect(result.current.activeColor).toBe(getCandyColor(uri))
    expect(result.current.iconProps.icons).toEqual({
      outline: CandyIcon,
      filled: CandyIcon,
    })
  },
)

it.each([
  [false, 'Like (2 likes)'],
  [true, 'Unlike (2 likes)'],
])(
  'keeps normal hearts and labels outside Halloween, liked=%s',
  (isLiked, label) => {
    mockActive = false
    const {result} = renderHook(
      () => useLikePresentation({uri, isLiked, likeCount: 2}),
      {wrapper: Wrapper},
    )
    expect(result.current.label).toBe(label)
    expect(result.current.activeColor).toBe(pink)
    expect(result.current.iconProps.icons).toBeUndefined()
  },
)

it('reverts on opt-out/expiry without changing the underlying liked state or count', () => {
  const post = {uri, isLiked: true, likeCount: 7}
  const {result, rerender} = renderHook(() => useLikePresentation(post), {
    wrapper: Wrapper,
  })
  expect(result.current.label).toBe('Take back candy (7 candies)')
  mockActive = false
  rerender({})
  expect(result.current.label).toBe('Unlike (7 likes)')
  expect(result.current.activeColor).toBe(pink)
  mockActive = true
  rerender({})
  expect(result.current.activeColor).toBe(getCandyColor(uri))
  expect(post).toEqual({uri, isLiked: true, likeCount: 7})
})
