import Svg, {Path} from 'react-native-svg'

import {type Props, useCommonSVGProps} from '#/components/icons/common'

const VIEWBOX_WIDTH = 498.09
const VIEWBOX_HEIGHT = 251.8

/**
 * The 40verse logo (source: assets/icons/community/40verse.svg). The mark is
 * about twice as wide as it is tall, so unlike the square icon template,
 * `size` sets the height and the width follows the aspect ratio.
 */
export function FortyVerse(props: Props) {
  const {fill, size, style, gradient, ...rest} = useCommonSVGProps(props)

  return (
    <Svg
      fill="none"
      {...rest}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      width={(size * VIEWBOX_WIDTH) / VIEWBOX_HEIGHT}
      height={size}
      style={[style]}>
      {gradient}
      <Path
        fill={fill}
        d="M298.94,0v56c53.32,15.46,105.28,41.85,147.47,78.03,23.95,20.53,79.47,71.44,34.83,98.78s-156.8,19.83-206.66,13.05c-89.7-12.19-195.11-53.81-254.16-124.84C-23.72,67.9,9.54,46.47,64.58,38.14c48.76-7.38,100.79-4.38,149.66.7L250.44,0h48.5ZM252.94,142V52l-83,90h83ZM133.74,58.29c-12.89.85-47.15,4.95-49.73,21.27-3.28,20.77,25.12,46.05,38.57,59.37l72.34-78.43c-.95-1.44-1.91-1.39-3.43-1.55-17.41-1.81-40.23-1.81-57.76-.65ZM369.94,142c-12.56-11.92-26.35-23.06-40.68-32.82-7.09-4.82-19.08-13.22-26.6-16.4-1.26-.54-2.26-1.04-3.72-.78v50h71ZM252.94,180h-78l30.33,18.17c15.53,6.65,31.01,14.67,47.67,17.83v-36ZM298.94,180v44.5c.64,1.02,1.38,1.28,2.51,1.49,6.59,1.2,17.1,1.69,24,2,20.01.88,69.43.71,84.03-13.95,9.52-9.56,2.82-24.93-4.04-34.04h-106.5Z"
      />
    </Svg>
  )
}
