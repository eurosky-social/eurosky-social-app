import {type TextProps} from 'react-native'
import {type PathProps, type SvgProps} from 'react-native-svg'
import {Image} from 'expo-image'

import {useLogoVariant} from '#/view/icons/useLogoVariant'
import {flatten, useTheme} from '#/alf'
import {BrandLogo} from '#/components/icons/BrandLogo'
import {BRAND} from '#/config/brand'

type Props = {
  allowVariants?: boolean
  fill?: PathProps['fill']
  style?: TextProps['style']
} & Omit<SvgProps, 'style'>

export function Logo(props: Props) {
  const t = useTheme()
  const {allowVariants = true, fill, width, style} = props
  const styles = flatten(style)
  // Brand mark is monochrome - default to the theme text colour (ink on
  // light, cotton on dark), not the accent. Callers can still override.
  const _fill = fill || styles?.color || t.atoms.text.color
  const size = parseInt(`${width ?? 32}`, 10)

  const logoVariant = useLogoVariant(allowVariants)

  if (logoVariant !== 'default') {
    const isJapanLogo = logoVariant === 'japan'
    return (
      <Image
        source={
          isJapanLogo
            ? require('../../../assets/icons/custom_logo_japan.svg')
            : size > 100
              ? require('../../../assets/kawaii.png')
              : require('../../../assets/kawaii_smol.png')
        }
        accessibilityLabel={BRAND.name}
        accessibilityHint=""
        accessibilityIgnoresInvertColors
        style={[{height: size, aspectRatio: isJapanLogo ? 2 : 1.4}]}
      />
    )
  }

  return <BrandLogo variant="mark" size={size} fill={_fill} style={styles} />
}
