import {type StyleProp, type TextStyle} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, web} from '#/alf'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {formatMediaTime} from '../record'
import {useJumpToMediaTime} from '../useJumpToMediaTime'

/**
 * The time link at the end of a comment (`▶ 0:41`), shown as a tappable time
 * instead of a web link: it plays the video from that second in the app.
 */
export function MediaTimeLink({
  videoPostUri,
  seconds,
  disabled = false,
  style,
}: {
  videoPostUri: string
  seconds: number
  disabled?: boolean
  style?: StyleProp<TextStyle>
}) {
  const {t: l} = useLingui()
  const jump = useJumpToMediaTime()
  const time = formatMediaTime(seconds)
  // Non-breaking space keeps the symbol and the time on one line.
  const label = `▶︎ ${time}`

  if (disabled) {
    return <Text style={[style, a.font_semi_bold]}>{label}</Text>
  }

  return (
    <Text
      accessibilityRole="button"
      accessibilityLabel={l`Play the video from ${time}`}
      accessibilityHint={l`Jumps to this moment in the video`}
      onPress={e => {
        // Posts in feeds sit inside a link on web; don't open the post too.
        if (IS_WEB) e.preventDefault()
        e.stopPropagation()
        jump(videoPostUri, seconds)
      }}
      style={[style, a.font_semi_bold, web({cursor: 'pointer'})]}>
      {label}
    </Text>
  )
}
