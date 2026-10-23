import {setupI18n} from '@lingui/core'
import {I18nProvider} from '@lingui/react'
import {renderHook} from '@testing-library/react-native'

import {getCandyColor} from './candy'
import {CandyIcon} from './CandyIcon'
import {useLikePresentation} from './useLikePresentation'

let mockSeason = true
jest.mock('#/features/halloween/context', () => ({
  useHalloween: () => ({isHalloween: mockSeason, isActive: false}),
}))
beforeEach(() => {
  mockSeason = true
})

const uri = 'at://did:plc:alice/app.bsky.feed.post/3kabc'
jest.mock('#/alf', () => ({useTheme: () => ({palette: {pink: '#EC4899'}})}))
const i18n = setupI18n({locale: 'en', messages: {en: {}}})
function Wrapper({children}: React.PropsWithChildren<{}>) {
  return <I18nProvider i18n={i18n}>{children}</I18nProvider>
}

it.each([
  [false, 0, 'Give candy (0 candies)'],
  [false, 1, 'Give candy (1 candy)'],
  [true, 2, 'Take back candy (2 candies)'],
])(
  'uses candy for an explicitly tagged post, liked=%s count=%s',
  (isLiked, likeCount, label) => {
    const {result} = renderHook(
      () =>
        useLikePresentation({
          uri,
          isLiked,
          likeCount,
          record: {isHalloweenCostume: true},
        }),
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

it('restores hearts on costume posts when the shared seasonal window ends', () => {
  const record = {isHalloweenCostume: true}
  const {result, rerender} = renderHook(
    () => useLikePresentation({uri, isLiked: true, likeCount: 2, record}),
    {wrapper: Wrapper},
  )
  expect(result.current.iconProps.icons).toBeDefined()
  mockSeason = false
  rerender({})
  expect(result.current.label).toBe('Unlike (2 likes)')
  expect(result.current.iconProps.icons).toBeUndefined()
})

it.each([
  undefined,
  {},
  {isHalloweenCostume: false},
  {isHalloweenCostume: 'true'},
  {text: 'Trick or treat!'},
])('keeps normal hearts for untagged or malformed records: %s', record => {
  const {result} = renderHook(
    () => useLikePresentation({uri, isLiked: true, likeCount: 2, record}),
    {wrapper: Wrapper},
  )
  expect(result.current.label).toBe('Unlike (2 likes)')
  expect(result.current.activeColor).toBe('#EC4899')
  expect(result.current.iconProps.icons).toBeUndefined()
})
