import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {PublisherVideoFeed} from '#/screens/VideoFeed'

/** Reuse native paging, pooled players, moderation, reporting and authenticated actions. */
export function ShortsScreen({
  route,
}: NativeStackScreenProps<CommonNavigatorParams, 'Shorts'>) {
  return <PublisherVideoFeed initialPostUri={route.params?.initialPostUri} />
}
