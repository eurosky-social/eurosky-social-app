import {useState} from 'react'
import {type Insets, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useTheme} from '#/alf'
import {BirthdayCake_Stroke2_Corner2_Rounded as CakeIcon} from '#/components/icons/BirthdayCake'
import {Pressable} from '#/components/Pressable'
import * as Tooltip from '#/components/Tooltip'

export function CakeDayBadge({
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
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const label = l({
    message: 'Cake day! Account creation anniversary.',
    comment:
      'Label for a cake icon beside a profile name, not a personal birthday.',
  })
  const icon = <CakeIcon width={width} fill={t.palette.primary_500} />

  if (!interactive) {
    return (
      <View
        testID="cakeDayBadge"
        accessible
        accessibilityLabel={label}
        accessibilityHint="">
        {icon}
      </View>
    )
  }

  return (
    <Tooltip.Outer visible={tooltipVisible} onVisibleChange={setTooltipVisible}>
      <Tooltip.Target>
        <Pressable
          testID="cakeDayBadge"
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint=""
          hitSlop={hitSlop}
          onPress={evt => {
            evt.preventDefault()
            evt.stopPropagation()
            setTooltipVisible(v => !v)
          }}>
          {icon}
        </Pressable>
      </Tooltip.Target>
      <Tooltip.BubbleText label={label}>{label}</Tooltip.BubbleText>
    </Tooltip.Outer>
  )
}
