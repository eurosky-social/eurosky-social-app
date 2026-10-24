import {type Props as SVGIconProps} from '#/components/icons/common'

export type AnimatedLikeIconProps = {
  isLiked: boolean
  big?: boolean
  hasBeenToggled: boolean
  color?: string
  icons?: {
    outline: React.ComponentType<SVGIconProps>
    filled: React.ComponentType<SVGIconProps>
  }
}
