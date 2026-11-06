import {type PathProps, type SvgProps} from 'react-native-svg'

import {usePalette} from '#/lib/hooks/usePalette'
import {BrandLogo} from '#/components/icons/BrandLogo'

/**
 * Product wordmark, using the news lockup in news builds. Defaults to the
 * theme text colour; callers can override.
 */
export function Logotype({
  fill,
  width,
  ...rest
}: {fill?: PathProps['fill']} & SvgProps) {
  const pal = usePalette('default')
  const size = parseInt(`${width ?? 32}`)

  return (
    <BrandLogo
      variant="wordmark"
      size={size}
      fill={fill || pal.text.color}
      {...rest}
    />
  )
}
