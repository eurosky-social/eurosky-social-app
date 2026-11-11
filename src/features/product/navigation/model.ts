import {
  getCurrentRoute,
  getTabState,
  isCurrentProfileRoute,
  isTab,
  TabState,
} from '#/lib/routes/helpers'
import {type State} from '#/lib/routes/types'
import {
  type NavigationConfig,
  type NavigationGroup,
  type NavigationId,
  type NavigationSurface,
} from '#/config/navigation'
import {type NavigationDestination} from './destinations'

/** Order and visibility are product choices; authorization remains with the screen. */
export function selectNavigation(
  config: NavigationConfig,
  surface: NavigationSurface,
  destinations: Record<NavigationId, NavigationDestination>,
  {
    hasSession,
    atmosphereEnabled,
    messagingEnabled,
    bookmarkingEnabled = true,
  }: {
    hasSession: boolean
    atmosphereEnabled: boolean
    messagingEnabled: boolean
    bookmarkingEnabled?: boolean
  },
): NavigationDestination[] {
  const ids = hasSession
    ? (config[surface] ?? config.bottomBar)
    : surface === 'sidebar'
      ? config.signedOutSidebar
      : surface === 'drawer'
        ? config.signedOutDrawer
        : []
  return ids
    .map(id => destinations[id])
    .filter(
      item =>
        (item.capability !== 'messaging' || messagingEnabled) &&
        (item.capability !== 'bookmarking' || bookmarkingEnabled) &&
        (hasSession || item.public) &&
        (item.feature !== 'atmosphere' || atmosphereEnabled),
    )
}

/** The group that starts at `index`, when the configured group changes there. */
export function groupStartingAt(
  destinations: readonly NavigationDestination[],
  index: number,
  config: NavigationConfig,
): NavigationGroup | undefined {
  const group = config.groups?.[destinations[index].id]
  const previous =
    index > 0 ? config.groups?.[destinations[index - 1].id] : undefined
  return group && group !== previous ? group : undefined
}

/** A common screen can be a section without owning an independent native stack. */
function matchesRoute(
  destination: NavigationDestination,
  state: State | undefined,
  handle?: string,
) {
  const route = getCurrentRoute(state)
  if (destination.id === 'profile') {
    return isCurrentProfileRoute({
      routeName: route.name,
      profileName: (route.params as {name?: string} | undefined)?.name,
      currentHandle: handle,
    })
  }
  return destination.routes.some(
    name => isTab(route.name, name) || route.name.startsWith(name),
  )
}

export function isNavigationActive(
  destination: NavigationDestination,
  state: State | undefined,
  {
    native,
    handle,
    destinations,
  }: {
    native: boolean
    handle?: string
    destinations: readonly NavigationDestination[]
  },
): boolean {
  if (native && state) {
    const commonSection = destinations.find(
      item => !item.tab && matchesRoute(item, state, handle),
    )
    if (commonSection) return commonSection.id === destination.id
    if (destination.tab)
      return getTabState(state, destination.tab) !== TabState.Outside
  }
  return matchesRoute(destination, state, handle)
}
