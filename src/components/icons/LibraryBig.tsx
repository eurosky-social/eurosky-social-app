import {forwardRef} from 'react'
import Svg, {G, Path, Rect} from 'react-native-svg'

import {type Props, useCommonSVGProps} from '#/components/icons/common'

/**
 * Lucide LibraryBig icon (lucide-static 1.31.0), licensed under ISC.
 * See NOTICE.md and licenses/LUCIDE-ISC.txt.
 */
export const LibraryBig = forwardRef<Svg, Props>(
  function LibraryBigImpl(props, ref) {
    const {fill, size, style, gradient, ...rest} = useCommonSVGProps(props)

    return (
      <Svg
        fill="none"
        {...rest}
        ref={ref}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        style={[style]}>
        {gradient}
        <G
          fill="none"
          stroke={fill}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round">
          <Rect width={8} height={18} x={3} y={3} rx={1} />
          <Path d="M7 3v18" />
          <Path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z" />
        </G>
      </Svg>
    )
  },
)
