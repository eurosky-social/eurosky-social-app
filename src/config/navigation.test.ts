import {validateNavigation} from './navigation'
import {getProduct} from './product'

const navigation = getProduct('social').navigation

it.each(['social', 'news'])('validates the %s preset', product => {
  expect(() => validateNavigation(getProduct(product).navigation)).not.toThrow()
})

it('preserves social defaults independently for each surface', () => {
  expect(navigation.sidebar).toEqual([
    'home',
    'news',
    'search',
    'notifications',
    'atmosphere',
    'chat',
    'feeds',
    'lists',
    'saved',
    'profile',
    'settings',
  ])
  expect(navigation.drawer.slice(0, 4)).toEqual([
    'search',
    'home',
    'news',
    'chat',
  ])
  expect(navigation.bottomBar).toEqual([
    'home',
    'search',
    'chat',
    'notifications',
    'profile',
  ])
  expect(navigation.signedOutSidebar).toEqual([])
  expect(navigation.signedOutDrawer).toEqual(['home', 'feeds', 'search'])
})

it.each(['sidebar', 'drawer', 'bottomBar', 'nativeBottomBar'] as const)(
  'adds Publisher to the minimal news %s',
  surface => {
    const news = getProduct('news').navigation
    expect(news[surface] ?? news.bottomBar).toEqual([
      'home',
      'publisher',
      'shorts',
      'saved',
      'profile',
    ])
  },
)

it('exposes only public news destinations in signed-out navigation', () => {
  const news = getProduct('news').navigation
  expect(news.signedOutSidebar).toEqual(['home', 'publisher', 'shorts'])
  expect(news.signedOutDrawer).toEqual(['home', 'publisher', 'shorts'])
})

it('supports adding and reordering existing destinations on mobile', () => {
  expect(() =>
    validateNavigation({
      ...navigation,
      bottomBar: ['news', 'feeds', 'settings'],
    }),
  ).not.toThrow()
})

it.each([
  undefined,
  {},
  {...navigation, sidebar: ['unknown']},
  {...navigation, drawer: ['home', 'home']},
  {...navigation, signedOutDrawer: ['typo']},
  {...navigation, bottomBar: []},
  {...navigation, nativeBottomBar: []},
  {...navigation, nativeBottomBar: ['invalid']},
  {...navigation, nativeBottomBar: ['home', 'home']},
  {
    ...navigation,
    bottomBar: ['home', 'news', 'search', 'chat', 'profile', 'settings'],
  },
])('rejects malformed navigation %j', value => {
  expect(() => validateNavigation(value)).toThrow()
})
