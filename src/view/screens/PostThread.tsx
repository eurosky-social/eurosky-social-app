import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {makeRecordUri} from '#/lib/strings/url-helpers'
import {PostThread} from '#/screens/PostThread'
import * as Layout from '#/components/Layout'
import {TileAutoplayProvider} from '#/features/tiles/autoplay'
import {isTileActivation} from '#/features/tiles/link'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'PostThread'>
export function PostThreadScreen({route}: Props) {
  const {name, rkey, view, tile} = route.params
  const uri = makeRecordUri(name, 'app.bsky.feed.post', rkey)

  return (
    <Layout.Screen testID="postThreadScreen">
      {/* EUROSKY: a tile card links here with `?tile=activate` (a web query param, so validate it) */}
      <TileAutoplayProvider
        name={isTileActivation(tile) ? name : undefined}
        rkey={rkey}>
        <PostThread
          uri={uri}
          // `view` can be a web query param, so validate it
          initialView={view === 'reader' ? 'reader' : undefined}
        />
      </TileAutoplayProvider>
    </Layout.Screen>
  )
}
