import {LayoutAnimation} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {HITSLOP_10} from '#/lib/constants'
import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {Text} from '#/components/Typography'

/**
 * Inline "Show more" link for truncated text. Mirrors `ShowMoreTextButton`
 * from `#/components/Post`, but takes its own accessibility label.
 */
export function ShowMoreButton({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}) {
  const t = useTheme()

  return (
    <Button
      label={label}
      onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
        onPress()
      }}
      style={[a.self_start, a.pb_2xs]}
      hitSlop={HITSLOP_10}>
      {({pressed, hovered}) => (
        <Text
          style={[
            a.leading_snug,
            t.atoms.text_link,
            {
              opacity: pressed ? 0.6 : 1,
              textDecorationLine: hovered ? 'underline' : undefined,
            },
          ]}>
          <Trans>Show more</Trans>
        </Text>
      )}
    </Button>
  )
}
