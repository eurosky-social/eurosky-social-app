import {type ViewStyle} from 'react-native'

import {useHalloween} from '#/features/halloween/context'
import {PixelLayer} from '#/features/halloween/costumes/PixelLayer'
import {useCostumes} from '#/features/halloween/costumes/state'

export function AvatarCostume({
  did,
  size,
  borderRadius,
}: {
  did?: string
  size: number
  borderRadius: ViewStyle['borderRadius']
}) {
  const {isActive} = useHalloween()
  const {costumes} = useCostumes()
  const costume = did ? costumes[did] : undefined
  return isActive && costume ? (
    <PixelLayer costume={costume} size={size} borderRadius={borderRadius} />
  ) : null
}
