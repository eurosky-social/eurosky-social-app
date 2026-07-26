import {View} from 'react-native'

import {atoms as a} from '#/alf'
import {type DecorationFrame} from './catalog'

/**
 * Code-drawn ring frame overlaid on UserAvatar. Follows the live-status
 * border pattern (absolute inset ring within the avatar bounds) so nothing
 * renders outside the container on any platform.
 */
export function AvatarDecorationRing({
  frame,
  size,
}: {
  frame: DecorationFrame
  size: number
}) {
  const width = Math.max(1.5, Math.round(size * 0.07 * 2) / 2)
  return (
    <View
      pointerEvents="none"
      style={[
        a.absolute,
        a.inset_0,
        a.rounded_full,
        {borderWidth: width, borderColor: frame.color},
      ]}
    />
  )
}
