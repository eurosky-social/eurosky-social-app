/** Stable product-facing destination IDs; labels and components live in the UI registry. */
export const NAVIGATION_IDS = [
  'home',
  'news',
  'publisher',
  'shorts',
  'search',
  'notifications',
  'atmosphere',
  'chat',
  'feeds',
  'lists',
  'saved',
  'profile',
  'settings',
] as const

export type NavigationId = (typeof NAVIGATION_IDS)[number]
export type NavigationSurface =
  'sidebar' | 'drawer' | 'bottomBar' | 'nativeBottomBar'
export type NavigationConfig = Readonly<
  Record<
    | Exclude<NavigationSurface, 'nativeBottomBar'>
    | 'signedOutSidebar'
    | 'signedOutDrawer',
    readonly NavigationId[]
  >
> & {readonly nativeBottomBar?: readonly NavigationId[]}

/** Validate JSON presets before they reach any navigation renderer. */
export function validateNavigation(
  value: unknown,
): asserts value is NavigationConfig {
  if (!value || typeof value !== 'object')
    throw new Error('Missing product navigation configuration')
  for (const surface of [
    'sidebar',
    'drawer',
    'bottomBar',
    'signedOutSidebar',
    'signedOutDrawer',
    'nativeBottomBar',
  ] as const) {
    const items: unknown = Reflect.get(value, surface)
    if (surface === 'nativeBottomBar' && items === undefined) continue
    if (
      !Array.isArray(items) ||
      items.some(id => !NAVIGATION_IDS.includes(id as NavigationId))
    ) {
      throw new Error(`Invalid navigation destination in ${surface}`)
    }
    if (new Set(items).size !== items.length)
      throw new Error(`Duplicate navigation destination in ${surface}`)
    if (
      (surface === 'bottomBar' || surface === 'nativeBottomBar') &&
      (items.length < 1 || items.length > 5)
    ) {
      throw new Error(`${surface} must contain between 1 and 5 destinations`)
    }
  }
}
