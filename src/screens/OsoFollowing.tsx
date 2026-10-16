import {
  type CommonNavigatorParams,
  type HomeTabNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {HomeScreen} from '#/view/screens/Home'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'OsoFollowing'>

/**
 * Oso's Following feed at /following. On Oso the home route is the landing
 * page, so the home feed screen (which shows only Following on Oso) gets its
 * own route here.
 */
export function OsoFollowingScreen(props: Props) {
  /*
   * HomeScreen only reads route params for its `Start` route, which this is
   * not, so the props are compatible apart from the route name.
   */
  return (
    <HomeScreen
      {...(props as unknown as NativeStackScreenProps<
        HomeTabNavigatorParams,
        'Home'
      >)}
    />
  )
}
