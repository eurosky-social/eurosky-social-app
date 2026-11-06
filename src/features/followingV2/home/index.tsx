import {
  type HomeTabNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {usePreferencesQuery} from '#/state/queries/preferences'
import {HomeScreen as LegacyHomeScreen} from '#/view/screens/Home'
import {NewsHomeScreen} from '#/screens/NewsHome'
import {useAnalytics} from '#/analytics'
import {PRODUCT} from '#/config/product'
import {isFollowingV2HomeForkEnabled} from '#/features/followingV2/eligibility'
import {HomeScreen as FollowingV2HomeScreen} from './Home'

/**
 * News Home is a public publisher reader. Social retains its existing Following
 * v2 eligibility and legacy fallback, including the opt-in merged feed.
 */
export function HomeScreen(
  props: NativeStackScreenProps<HomeTabNavigatorParams, 'Home' | 'Start'>,
) {
  return PRODUCT.id === 'news' ? (
    <NewsHomeScreen />
  ) : (
    <SocialHomeScreen {...props} />
  )
}

function SocialHomeScreen(
  props: NativeStackScreenProps<HomeTabNavigatorParams, 'Home' | 'Start'>,
) {
  const ax = useAnalytics()
  const {data: preferences} = usePreferencesQuery()
  // The opt-in merged following feed still uses the stateful legacy API.
  const mergedFollowing = preferences?.feedViewPrefs.lab_mergeFeedEnabled
  return isFollowingV2HomeForkEnabled(ax) && !mergedFollowing ? (
    <FollowingV2HomeScreen {...props} />
  ) : (
    <LegacyHomeScreen {...props} />
  )
}
