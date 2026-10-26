import {type TextProps} from 'react-native'
import {type PathProps, type SvgProps} from 'react-native-svg'

import {flatten, useTheme} from '#/alf'
import {BrandLogo} from '#/components/icons/BrandLogo'

type Props = {
  fill?: PathProps['fill']
  style?: TextProps['style']
} & Omit<SvgProps, 'style'>

export function Logo(props: Props) {
  const t = useTheme()
  const {fill, width, style} = props
  const styles = flatten(style)
  // Brand mark is monochrome - default to the theme text colour (ink on
  // light, cotton on dark), not the accent. Callers can still override.
  const _fill = fill || styles?.color || t.atoms.text.color
  const size = parseInt(`${width ?? 32}`, 10)

  return <BrandLogo variant="mark" size={size} fill={_fill} style={styles} />
}
