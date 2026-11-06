import {BrandLogo} from './BrandLogo'
import {type Props, useCommonSVGProps} from './common'

/**
 * Shared brand mark and product lockup. `Mark` stays icon-sized; `Full`
 * includes the news wordmark in news builds and is aspect-correct.
 */
export function Mark(props: Props) {
  const {fill, size, style} = useCommonSVGProps(props)
  return (
    <BrandLogo variant="mark" size={size} square fill={fill} style={style} />
  )
}

export function Full(
  props: Omit<Props, 'fill' | 'size' | 'height'> & {
    markFill?: Props['fill']
    textFill?: Props['fill']
  },
) {
  const {fill, size, style} = useCommonSVGProps(props)

  return (
    <BrandLogo
      variant="lockup"
      size={size}
      fill={props.markFill ?? props.textFill ?? fill}
      style={style}
    />
  )
}
