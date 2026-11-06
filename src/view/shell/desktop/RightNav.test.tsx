import {render, screen} from '@testing-library/react-native'

import {getProduct, PRODUCT} from '#/config/product'
import {PageLayoutProvider} from '#/features/product/layout/context'
import {DesktopRightNav} from './RightNav'

jest.mock('#/config/product', () => {
  const actual = jest.requireActual<{getProduct: typeof getProduct}>(
    '#/config/product',
  )
  return {...actual, PRODUCT: actual.getProduct('social')}
})

jest.mock('@lingui/react', () => ({
  useLingui: () => ({_: jest.fn()}),
  Trans: () => null,
}))
jest.mock('@react-navigation/native', () => ({
  useNavigationState: (selector: (state: unknown) => unknown) => selector({}),
}))
jest.mock('#/lib/routes/helpers', () => ({
  getCurrentRoute: () => ({params: {view: mockView}}),
}))
jest.mock('#/state/session', () => ({
  useSession: () => ({hasSession: true}),
}))
jest.mock('#/alf', () => ({
  atoms: new Proxy({}, {get: () => ({transform: []})}),
  tokens: {space: {lg: 16}},
  useGutters: () => ({paddingBottom: 0, paddingLeft: 16}),
  useLayoutBreakpoints: () => ({rightNavVisible: true}),
  useTheme: () => ({atoms: {}}),
  web: () => ({}),
}))
jest.mock('#/features/newsFeed/config', () => ({
  get NEWS_V2_ENABLED() {
    return mockNewsV2Enabled
  },
}))
jest.mock('#/features/frontpages/legacy/NewsroomRightRail', () => ({
  NewsroomRightRail: () => {
    const {Text} = require('react-native') as typeof import('react-native')
    return <Text>Legacy newsroom rail</Text>
  },
}))
jest.mock('#/features/frontpages/components/FrontpageRightRail', () => ({
  FrontpageRightRail: () => {
    const {Text} = require('react-native') as typeof import('react-native')
    return <Text>V2 frontpage rail</Text>
  },
}))
jest.mock('#/features/news/article/NewsArticleRightRail', () => ({
  NewsArticleRightRail: () => {
    const {Text} = require('react-native') as typeof import('react-native')
    return <Text>Article rail</Text>
  },
}))
jest.mock('#/features/newsFeed/legacy/NewsFeedRightRail', () => ({}))
jest.mock('#/view/shell/desktop/Feeds', () => ({
  DesktopFeeds: () => {
    const {Text} = require('react-native') as typeof import('react-native')
    return <Text>Feeds</Text>
  },
}))
jest.mock('#/view/shell/desktop/Search', () => ({
  DesktopSearch: () => {
    const {Text} = require('react-native') as typeof import('react-native')
    return <Text>Search</Text>
  },
}))
jest.mock('#/components/AppLanguageDropdown', () => ({}))
jest.mock('#/components/Button', () => ({
  ButtonText: (require('react-native') as typeof import('react-native')).Text,
  ButtonIcon: () => null,
}))
jest.mock('#/components/Layout', () => ({CENTER_COLUMN_OFFSET: 0}))
jest.mock('#/components/Link', () => ({
  Link: (require('react-native') as typeof import('react-native')).View,
  InlineLinkText: (require('react-native') as typeof import('react-native'))
    .Text,
}))
jest.mock('#/components/Typography', () => ({
  Text: (require('react-native') as typeof import('react-native')).Text,
}))

afterEach(() => jest.restoreAllMocks())

it('hides the rail globally without needing a wide page', () => {
  jest.replaceProperty(PRODUCT, 'layout', getProduct('news').layout)
  const {toJSON} = render(
    <PageLayoutProvider routeName="Profile">
      <DesktopRightNav routeName="Profile" />
    </PageLayoutProvider>,
  )
  expect(toJSON()).toBeNull()
})
it('can restore a sidebar on one page of a globally hidden product', () => {
  jest.replaceProperty(PRODUCT, 'layout', {
    defaults: {rightSidebar: 'hidden'},
    pages: {Frontpage: {rightSidebar: 'default'}},
  })
  render(
    <PageLayoutProvider routeName="Frontpage">
      <DesktopRightNav routeName="Frontpage" />
    </PageLayoutProvider>,
  )
  expect(screen.getByText('Search')).toBeTruthy()
  expect(screen.queryByText('Legacy newsroom rail')).toBeNull()
})
it('can replace the rail content independently of width', () => {
  jest.replaceProperty(PRODUCT, 'layout', {
    defaults: {},
    pages: {Frontpage: {rightSidebar: 'article'}},
  })
  render(
    <PageLayoutProvider routeName="Frontpage">
      <DesktopRightNav routeName="Frontpage" />
    </PageLayoutProvider>,
  )
  expect(screen.getByText('Article rail')).toBeTruthy()
  expect(screen.queryByText('Legacy newsroom rail')).toBeNull()
})

let mockNewsV2Enabled = false
let mockView: string | undefined

beforeEach(() => {
  mockNewsV2Enabled = false
  mockView = undefined
})

it('keeps the original desktop newsroom rail in v1', () => {
  render(<DesktopRightNav routeName="Frontpage" />)
  expect(screen.getByText('Legacy newsroom rail')).toBeTruthy()
})

it('leaves the right column to the editorial spread only in v2', () => {
  mockNewsV2Enabled = true
  const {toJSON} = render(<DesktopRightNav routeName="Frontpage" />)
  expect(toJSON()).toBeNull()
})

it('keeps the v2 contextual rail on its separate conversation view', () => {
  mockNewsV2Enabled = true
  mockView = 'conversation'
  render(<DesktopRightNav routeName="Frontpage" />)
  expect(screen.getByText('V2 frontpage rail')).toBeTruthy()
})
