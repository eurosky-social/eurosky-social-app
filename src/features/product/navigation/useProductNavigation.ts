import {useSession} from '#/state/session'
import {useAnalytics} from '#/analytics'
import {type NavigationSurface} from '#/config/navigation'
import {PRODUCT} from '#/config/product'
import {NEWS_V2_ENABLED} from '#/features/newsFeed/config'
import {getNavigationDestinations} from './destinations'
import {selectNavigation} from './model'

/** Resolve the selected surface while preserving upstream feature/session gates. */
export function useProductNavigation(surface: NavigationSurface) {
  const {hasSession, currentAccount} = useSession()
  const ax = useAnalytics()
  const destinations = getNavigationDestinations({
    account: currentAccount,
    newsV2: NEWS_V2_ENABLED,
  })
  return selectNavigation(PRODUCT.navigation, surface, destinations, {
    hasSession,
    messagingEnabled: PRODUCT.capabilities.messaging,
    atmosphereEnabled: ax.features.enabled(ax.features.AtmosphereScreenEnable),
  })
}
