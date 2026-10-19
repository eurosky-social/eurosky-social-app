import {useState} from 'react'
import {type Insets, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useTheme} from '#/alf'
import {Heart2_Filled_Stroke2_Corner0_Rounded as HeartIcon} from '#/components/icons/Heart2'
import {Pressable} from '#/components/Pressable'
import * as Tooltip from '#/components/Tooltip'
import {BRAND} from '#/config/brand'

const appName = BRAND.name

/** Fixed supporter mark, intentionally distinct from identity verification. */
export function SupporterBadge({
  width,
  interactive = false,
  hitSlop,
}: {
  width: number
  interactive?: boolean
  hitSlop?: Insets
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [visible, setVisible] = useState(false)
  const label = l`${appName} supporter`
  const icon = <HeartIcon width={width} fill={t.palette.pink} />

  if (!interactive) {
    return (
      <View
        testID="supporterBadge"
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        accessibilityHint="">
        {icon}
      </View>
    )
  }

  return (
    <Tooltip.Outer visible={visible} onVisibleChange={setVisible}>
      <Tooltip.Target>
        <Pressable
          testID="supporterBadge"
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={l`Explains the supporter badge`}
          hitSlop={hitSlop}
          onPress={event => {
            event.preventDefault()
            event.stopPropagation()
            setVisible(value => !value)
          }}
          onHoverIn={() => setVisible(true)}
          onHoverOut={() => setVisible(false)}>
          {icon}
        </Pressable>
      </Tooltip.Target>
      <Tooltip.BubbleText label={label}>
        <Trans>Supports {appName}. This is not identity verification.</Trans>
      </Tooltip.BubbleText>
    </Tooltip.Outer>
  )
}
