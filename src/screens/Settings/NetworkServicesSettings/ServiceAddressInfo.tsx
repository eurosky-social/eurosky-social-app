import {useState} from 'react'
import {Pressable} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {CircleInfo_Stroke2_Corner0_Rounded as CircleInfoIcon} from '#/components/icons/CircleInfo'
import * as Tooltip from '#/components/Tooltip'

export function ServiceAddressInfo({name, url}: {name: string; url: string}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const [visible, setVisible] = useState(false)
  const label = l`Show service address for ${name}`

  return (
    <Tooltip.Outer visible={visible} onVisibleChange={setVisible}>
      <Tooltip.Target>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={l`Shows the service address`}
          hitSlop={8}
          onHoverIn={() => setVisible(true)}
          onHoverOut={() => setVisible(false)}
          onPress={() => setVisible(value => !value)}
          style={[a.rounded_full, a.p_xs]}>
          <CircleInfoIcon size="sm" fill={t.atoms.text_contrast_medium.color} />
        </Pressable>
      </Tooltip.Target>
      <Tooltip.BubbleText label={label}>{url}</Tooltip.BubbleText>
    </Tooltip.Outer>
  )
}
