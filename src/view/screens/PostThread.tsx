import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {makeRecordUri} from '#/lib/strings/url-helpers'
import {PostThread} from '#/screens/PostThread'
import * as Layout from '#/components/Layout'
import {useMediaTimeParam} from '#/features/mediaTime/useMediaTimeParam'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'PostThread'>
export function PostThreadScreen({route}: Props) {
  const {name, rkey, view, t} = route.params
  const uri = makeRecordUri(name, 'app.bsky.feed.post', rkey)
  // Eurosky: `?t=41` plays the post's video from that second.
  useMediaTimeParam({postUri: uri, name, rkey, t})

  return (
    <Layout.Screen testID="postThreadScreen">
      <PostThread
        uri={uri}
        // `view` can be a web query param, so validate it
        initialView={view === 'reader' ? 'reader' : undefined}
      />
    </Layout.Screen>
  )
}
