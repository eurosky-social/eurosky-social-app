import {render, screen} from '@testing-library/react-native'

import {DesktopRightNav} from './RightNav'

jest.mock('@lingui/react', () => ({useLingui: () => ({_: jest.fn()})}))
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
jest.mock('#/features/news/article/NewsArticleRightRail', () => ({}))
jest.mock('#/features/newsFeed/legacy/NewsFeedRightRail', () => ({}))
jest.mock('#/view/shell/desktop/Feeds', () => ({}))
jest.mock('#/view/shell/desktop/Search', () => ({}))
jest.mock('#/components/AppLanguageDropdown', () => ({}))
jest.mock('#/components/Button', () => ({}))
jest.mock('#/components/Layout', () => ({CENTER_COLUMN_OFFSET: 0}))
jest.mock('#/components/Link', () => ({}))
jest.mock('#/components/Typography', () => ({}))

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
