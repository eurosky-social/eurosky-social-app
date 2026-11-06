import {type PathProps, type SvgProps} from 'react-native-svg'

import {useTheme} from '#/alf'
import {BrandLogo} from '#/components/icons/BrandLogo'

/**
 * Product lockup. Social falls back to the mu mark; news includes its name.
 */
export function LogomarkWithType({
  fill,
  width,
  ...rest
}: {fill?: PathProps['fill']} & SvgProps) {
  const t = useTheme()
  const size = parseInt(`${width ?? 32}`)

  return (
    <BrandLogo
      variant="lockup"
      size={size}
      fill={fill || t.atoms.text.color}
      {...rest}
    />
  )
}
