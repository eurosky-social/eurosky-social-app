import {Children, isValidElement} from 'react'
import {renderHook} from '@testing-library/react-native'

import {
  type ArticleGridItemProps,
  type ArticleGridProps,
} from './ArticleGrid/types'
import {ArticleList} from './ArticleList'
import {type PostArticle} from './articles'

jest.mock('./Article', () => ({Article: () => null}))
jest.mock('#/alf', () => ({atoms: {}, useTheme: () => ({atoms: {}})}))
function element<P>(node: React.ReactNode) {
  if (!isValidElement<P>(node)) throw new Error('Expected an element')
  return node
}
function story(id: string) {
  return {
    image: 'https://example.com/image.jpg',
    item: {uri: `at://did:plc:publisher/app.bsky.feed.post/${id}`},
  } as PostArticle
}
it('retains collection sizes and does not introduce another lead after an inserted section', () => {
  const {result} = renderHook(() =>
    ArticleList({articles: [story('four'), story('five')], offset: 4}),
  )
  const grid = element<ArticleGridProps>(result.current)
  expect(grid.props.sizes).toEqual(['big', 'small'])
  const item = element<ArticleGridItemProps>(
    Children.toArray(grid.props.children)[0],
  )
  expect(
    element<{lead: boolean; linkTo: string}>(item.props.children).props,
  ).toMatchObject({lead: false, linkTo: 'post'})
})
it('keeps existing bands stable when the offset section paginates', () => {
  const {result, rerender} = renderHook(
    ({count}: {count: number}) =>
      ArticleList({
        articles: Array.from({length: count}, (_, index) => story(`${index}`)),
        offset: 4,
      }),
    {initialProps: {count: 2}},
  )
  const before = element<ArticleGridProps>(result.current).props.bands ?? []
  expect(before).toHaveLength(2)
  rerender({count: 30})
  expect(
    element<ArticleGridProps>(result.current).props.bands?.slice(
      0,
      before.length,
    ),
  ).toEqual(before)
})
