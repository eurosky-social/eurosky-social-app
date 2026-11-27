import {Pressable, type StyleProp, type ViewStyle} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useSession} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {MEDIA_TIME_ENABLED} from '../config'
import {openInsights} from '../openInsights'

/**
 * "Insights for your video", for the video's author only: opens how many
 * comments it has, where, and which wait for an answer. Renders nothing for
 * anyone else.
 */
export function InsightsLink({
  post,
  style,
}: {
  post: Pick<app.bsky.feed.defs.PostView, 'uri' | 'author'>
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  if (!MEDIA_TIME_ENABLED || currentAccount?.did !== post.author.did) {
    return null
  }
  return (
    <Pressable
      testID="mediaTimeInsightsLink"
      accessibilityRole="link"
      accessibilityLabel={l`Insights for your video`}
      accessibilityHint={l`Opens how many comments your video has, where, and which wait for your answer`}
      hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
      style={[a.self_start, style]}
      onPress={() => openInsights(post.uri)}>
      <Text
        style={[a.text_xs, a.font_semi_bold, {color: t.palette.primary_600}]}>
        <Trans>Insights for your video</Trans>
      </Text>
    </Pressable>
  )
}
