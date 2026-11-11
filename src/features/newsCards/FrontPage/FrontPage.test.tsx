import {Text} from 'react-native'
import {render, screen} from '@testing-library/react-native'

import {type PostArticle} from '#/features/articles/articles'
import {FrontPage, FrontPageSkeleton} from './index'

jest.mock('#/alf', () => ({
  atoms: new Proxy({}, {get: () => ({})}),
  web: (style: unknown) => style,
  useTheme: () => ({
    atoms: new Proxy({}, {get: () => ({})}),
    palette: new Proxy({}, {get: () => '#000'}),
  }),
}))
jest.mock('./useFrontPageColumns', () => ({
  /* Mirrors columnsForWidth after the 16px gutters on each side. */
  useFrontPageColumns: () =>
    mockWidth - 32 >= 960 ? 3 : mockWidth - 32 >= 600 ? 2 : 1,
}))
jest.mock('../NewsCard', () => {
  const {Text: RNText} =
    require('react-native') as typeof import('react-native')
  return {
    NewsCard: ({size}: {size: string}) => (
      <RNText testID="newsCardSize">{size}</RNText>
    ),
  }
})
jest.mock('../model', () => ({
  cardHasMedia: () => true,
}))

let mockWidth = 1440

function stories(count: number) {
  return Array.from(
    {length: count},
    (_, index) =>
      ({
        item: {uri: `at://did:plc:pub/app.bsky.feed.post/${index}`},
      }) as unknown as PostArticle,
  )
}

function rowIds() {
  return screen
    .getAllByTestId(/^frontPage(Row-|Shorts)/)
    .map(node => node.props.testID as string)
}

it('lays out the three-column rhythm with Shorts after the third row', () => {
  mockWidth = 1440
  render(<FrontPage articles={stories(11)} shorts={<Text>Shorts row</Text>} />)
  expect(rowIds()).toEqual([
    'frontPageRow-3',
    'frontPageRow-2-1',
    'frontPageRow-1-1-1',
    'frontPageShorts',
    'frontPageRow-1-2',
    'frontPageRow-3',
    'frontPageRow-2-1',
  ])
  expect(screen.getAllByTestId('newsCardSize')[0]).toHaveTextContent('lead')
})

it('reflows to two columns at tablet width', () => {
  mockWidth = 700
  render(<FrontPage articles={stories(6)} />)
  expect(rowIds()).toEqual([
    'frontPageRow-2',
    'frontPageRow-2',
    'frontPageRow-1-1',
    'frontPageRow-1-1',
  ])
  expect(screen.getAllByTestId('newsCardSize')[0]).toHaveTextContent(
    'leadTablet',
  )
})

it('puts one card per row on phones, with compact one-third cards', () => {
  mockWidth = 390
  render(<FrontPage articles={stories(3)} />)
  expect(rowIds()).toEqual([
    'frontPageRow-1',
    'frontPageRow-1',
    'frontPageRow-1',
  ])
  expect(
    screen.getAllByTestId('newsCardSize').map(node => node.props.children),
  ).toEqual(['leadPhone', 'featurePhone', 'compact'])
})

it('renders four hidden placeholder cards while loading', () => {
  mockWidth = 1440
  render(<FrontPageSkeleton />)
  expect(
    screen.getAllByTestId('frontPageSkeletonCard', {
      includeHiddenElements: true,
    }),
  ).toHaveLength(4)
  expect(screen.queryAllByTestId('frontPageSkeletonCard')).toHaveLength(0)
})
