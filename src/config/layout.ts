import {type CommonNavigatorParams} from '#/lib/routes/types'
import {BREAKPOINTS} from '#/alf/breakpoints.shared'
import {
  CENTER_COLUMN_OFFSET,
  CENTER_COLUMN_WIDTH,
  PINNED_LEFT_NAV_RAIL_WIDTH,
  PINNED_LEFT_NAV_WIDTH,
  PINNED_MAX_CONTENT_WIDTH,
} from '#/components/Layout/const'

/** Auto preserves the route's existing contextual rail; named rails replace it. */
export const RIGHT_SIDEBARS = [
  'auto',
  'hidden',
  'default',
  'publication',
  'article',
] as const
export type RightSidebar = (typeof RIGHT_SIDEBARS)[number]
export type PageLayout = {
  contentWidth: 'standard' | 'wide'
  rightSidebar: RightSidebar
}
export type LayoutConfig = {
  defaults: Partial<PageLayout>
  pages: Partial<Record<keyof CommonNavigatorParams, Partial<PageLayout>>>
  /**
   * `pinned` puts the desktop web navigation at the window's left edge and
   * centres content in the remaining space; the default keeps it beside the
   * centred 600px column.
   */
  leftNav?: 'pinned' | 'centred'
}

/** Validate operator-owned JSON without importing screens or navigation state. */
export function validateLayout(value: unknown): asserts value is LayoutConfig {
  if (!value || typeof value !== 'object')
    throw new Error('Missing product layout configuration')
  const leftNav: unknown = Reflect.get(value, 'leftNav')
  if (leftNav !== undefined && leftNav !== 'pinned' && leftNav !== 'centred')
    throw new Error('Invalid layout setting leftNav')
  const defaults: unknown = Reflect.get(value, 'defaults')
  const pages: unknown = Reflect.get(value, 'pages')
  if (!pages || typeof pages !== 'object' || Array.isArray(pages))
    throw new Error('Invalid layout pages')
  for (const entry of [defaults, ...Object.values(pages)]) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      throw new Error('Invalid page layout')
    for (const [key, setting] of Object.entries(entry)) {
      if (
        key === 'contentWidth' &&
        typeof setting === 'string' &&
        ['standard', 'wide'].includes(setting)
      )
        continue
      if (
        key === 'rightSidebar' &&
        RIGHT_SIDEBARS.some(value => value === setting)
      )
        continue
      throw new Error(`Invalid page layout setting ${key}`)
    }
  }
}

/** Preserve legacy news spreads and message split views unless explicitly overridden. */
export function resolvePageLayout(
  config: LayoutConfig,
  routeName: string,
  params?: {view?: string},
  newsV2 = false,
): PageLayout {
  const spread =
    newsV2 &&
    ([
      'NewsExplore',
      'NewsOutlets',
      'OutletDirectory',
      'NewsFeed',
      'NewsSettings',
    ].includes(routeName) ||
      (routeName === 'Frontpage' && params?.view !== 'conversation'))
  const contextualHidden = spread || routeName.startsWith('Messages')
  const selected: PageLayout = {
    contentWidth: spread ? 'wide' : 'standard',
    rightSidebar: 'auto',
    ...config.defaults,
    ...config.pages[routeName as keyof CommonNavigatorParams],
  }
  return {
    ...selected,
    rightSidebar:
      selected.rightSidebar === 'auto'
        ? contextualHidden
          ? 'hidden'
          : 'auto'
        : selected.rightSidebar,
  }
}

/** A wide page reserves rail space independently, never borrowing a visible sidebar's column. */
/**
 * Pinned nav width: none on mobile, the icon rail up to the tablet breakpoint.
 * Signed-out readers get the bottom bar instead of a rail.
 */
export function leftNavWidth(
  windowWidth: number,
  {signedIn = true}: {signedIn?: boolean} = {},
) {
  if (windowWidth < BREAKPOINTS.mobile) return 0
  if (windowWidth <= BREAKPOINTS.tablet)
    return signedIn ? PINNED_LEFT_NAV_RAIL_WIDTH : 0
  return PINNED_LEFT_NAV_WIDTH
}

export function pageGeometry({
  windowWidth,
  contentWidth,
  rightNavVisible,
  centerColumnOffset,
  navWidth,
}: {
  windowWidth: number
  contentWidth: PageLayout['contentWidth']
  rightNavVisible: boolean
  centerColumnOffset: boolean
  /** Set when the nav is pinned left: content centres in the space beside it. */
  navWidth?: number
}) {
  if (navWidth !== undefined) {
    const width =
      contentWidth === 'wide'
        ? Math.min(windowWidth - navWidth, PINNED_MAX_CONTENT_WIDTH)
        : CENTER_COLUMN_WIDTH
    return {width, offset: navWidth / 2, wide: width > CENTER_COLUMN_WIDTH}
  }
  const wide = contentWidth === 'wide' && windowWidth >= 1100
  const available =
    windowWidth / 2 +
    CENTER_COLUMN_WIDTH / 2 -
    40 -
    (centerColumnOffset ? CENTER_COLUMN_OFFSET : 0) -
    (rightNavVisible ? 350 : 0)
  const width = wide
    ? Math.min(Math.max(available, CENTER_COLUMN_WIDTH), 1500)
    : CENTER_COLUMN_WIDTH
  return {width, offset: (width - CENTER_COLUMN_WIDTH) / 2, wide: width > 600}
}
