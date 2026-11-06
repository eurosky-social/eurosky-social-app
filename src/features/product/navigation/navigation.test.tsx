import {Text} from 'react-native'
import {render} from '@testing-library/react-native'

import {type State} from '#/lib/routes/types'
import {NAVIGATION_IDS} from '#/config/navigation'
import {getProduct} from '#/config/product'
import {getNavigationDestinations} from './destinations'
import {isNavigationActive, selectNavigation} from './model'
import {NavigationItems, NavigationSlot} from './NavigationItems'

jest.mock('#/alf', () => ({}))

const definitions = getNavigationDestinations({
  newsV2: true,
  account: {handle: 'alice.test', did: 'did:plc:alice'},
})
const navigation = getProduct('social').navigation
const signedIn = {
  hasSession: true,
  atmosphereEnabled: true,
  messagingEnabled: true,
}

function state(tab: string, route: string, params?: object): State {
  return {
    index: 0,
    routes: [{name: tab, state: {index: 0, routes: [{name: route, params}]}}],
  }
}

it('defines every allowed ID once with shared page metadata', () => {
  expect(Object.keys(definitions).sort()).toEqual([...NAVIGATION_IDS].sort())
  for (const [id, destination] of Object.entries(definitions)) {
    expect(destination.id).toBe(id)
    expect(destination.label.id).toBeTruthy()
    expect(destination.href).toMatch(/^\//)
  }
})

it('selects each surface in configured order and filters upstream-gated items', () => {
  const config = {
    ...navigation,
    sidebar: ['settings', 'atmosphere', 'news'] as const,
  }
  expect(
    selectNavigation(config, 'sidebar', definitions, signedIn).map(d => d.id),
  ).toEqual(['settings', 'atmosphere', 'news'])
  expect(
    selectNavigation(config, 'sidebar', definitions, {
      ...signedIn,
      atmosphereEnabled: false,
    }).map(d => d.id),
  ).toEqual(['settings', 'news'])
  expect(
    selectNavigation(config, 'bottomBar', definitions, signedIn).map(d => d.id),
  ).toEqual(navigation.bottomBar)
})

it.each(['sidebar', 'drawer', 'bottomBar', 'nativeBottomBar'] as const)(
  'cannot re-enable messaging by configuring the %s menu',
  surface => {
    const config = {...navigation, [surface]: ['chat', 'home'] as const}
    expect(
      selectNavigation(config, surface, definitions, {
        ...signedIn,
        messagingEnabled: false,
      }).map(d => d.id),
    ).toEqual(['home'])
  },
)

it('shares bottom-bar defaults but allows a different native order', () => {
  expect(
    selectNavigation(navigation, 'nativeBottomBar', definitions, signedIn).map(
      d => d.id,
    ),
  ).toEqual(navigation.bottomBar)
  const config = {...navigation, nativeBottomBar: ['news', 'settings'] as const}
  expect(
    selectNavigation(config, 'nativeBottomBar', definitions, signedIn).map(
      d => d.id,
    ),
  ).toEqual(['news', 'settings'])
  expect(
    selectNavigation(config, 'bottomBar', definitions, signedIn).map(d => d.id),
  ).toEqual(navigation.bottomBar)
})

it('preserves signed-out navigation and never exposes account-only items', () => {
  expect(
    selectNavigation(navigation, 'drawer', definitions, {
      ...signedIn,
      hasSession: false,
    }).map(d => d.id),
  ).toEqual(['home', 'feeds', 'search'])
  expect(
    selectNavigation(
      {...navigation, signedOutSidebar: ['news', 'chat', 'home']},
      'sidebar',
      definitions,
      {...signedIn, hasSession: false},
    ).map(d => d.id),
  ).toEqual(['home'])
  expect(
    selectNavigation(navigation, 'bottomBar', definitions, {
      ...signedIn,
      hasSession: false,
    }),
  ).toEqual([])
})

it('renders configured order, omits hidden slots, and falls back for newly exposed pages', () => {
  const screen = render(
    <NavigationItems
      destinations={[definitions.news, definitions.profile, definitions.home]}
      renderItem={item => <Text>{`generic-${item.id}`}</Text>}>
      <NavigationSlot id="home">
        <Text>custom-home</Text>
      </NavigationSlot>
      <NavigationSlot id="chat">
        <Text>hidden-chat</Text>
      </NavigationSlot>
      <NavigationSlot id="profile">
        <Text>profile-avatar</Text>
      </NavigationSlot>
    </NavigationItems>,
  )
  expect(
    screen.UNSAFE_getAllByType(Text).map(node => node.props.children),
  ).toEqual(['generic-news', 'profile-avatar', 'custom-home'])
  expect(screen.queryByText('hidden-chat')).toBeNull()
})

it('keeps native parent-tab selection on nested screens and isolates common sections', () => {
  const destinations = [definitions.home, definitions.news, definitions.profile]
  const options = {native: true, handle: 'alice.test', destinations}
  expect(
    isNavigationActive(
      definitions.home,
      state('HomeTab', 'PostThread'),
      options,
    ),
  ).toBe(true)
  expect(
    isNavigationActive(
      definitions.news,
      state('HomeTab', 'Frontpage'),
      options,
    ),
  ).toBe(true)
  expect(
    isNavigationActive(
      definitions.home,
      state('HomeTab', 'Frontpage'),
      options,
    ),
  ).toBe(false)
  expect(
    isNavigationActive(
      definitions.feeds,
      state('FeedsTab', 'PostThread'),
      options,
    ),
  ).toBe(true)
})

it('matches related web routes and only highlights the current account profile', () => {
  const options = {
    native: false,
    handle: 'alice.test',
    destinations: Object.values(definitions),
  }
  expect(
    isNavigationActive(definitions.news, state('Flat', 'NewsArticle'), options),
  ).toBe(true)
  expect(
    isNavigationActive(definitions.home, state('Flat', 'NewsArticle'), options),
  ).toBe(false)
  expect(
    isNavigationActive(
      definitions.profile,
      state('Flat', 'Profile', {name: 'bob.test'}),
      options,
    ),
  ).toBe(false)
  expect(
    isNavigationActive(
      definitions.profile,
      state('Flat', 'Profile', {name: 'alice.test'}),
      options,
    ),
  ).toBe(true)
})

it('resolves news v1/v2 and the signed-in profile without changing route registration', () => {
  expect(definitions.news.target).toEqual({
    name: 'NewsExplore',
    params: undefined,
  })
  expect(definitions.profile.href).toBe('/profile/alice.test')
  expect(getNavigationDestinations({newsV2: false}).news.href).toBe('/news')
})
