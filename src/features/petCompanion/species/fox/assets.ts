// The fox ships as a single combined sheet (one coat), so there's just one
// variant. Geometry and the animation catalog live in ./catalog.

import {type ImageRequireSource} from 'react-native'

import {type FoxVariant} from './catalog'

export const FOX_SHEETS: Record<FoxVariant, ImageRequireSource> = {
  red: require('../../../../../assets/pets/fox/AllFoxTogether.png'),
}
