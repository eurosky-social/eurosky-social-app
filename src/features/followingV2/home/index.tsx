import {
  type HomeTabNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {usePreferencesQuery} from '#/state/queries/preferences'
import {HomeScreen as LegacyHomeScreen} from '#/view/screens/Home'
import {useAnalytics} from '#/analytics'
import {isFollowingV2HomeForkEnabled} from '#/features/followingV2/eligibility'
import {HomeScreen as FollowingV2HomeScreen} from './Home'

/**
 * The Home route. With `following_v2:enable` on, it renders the fork of Home in
 * this directory, which is where Following v2 changes land, on every platform.
 * Otherwise it renders today's Home, unchanged.
 */
export function HomeScreen(
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
