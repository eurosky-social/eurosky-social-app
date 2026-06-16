// Static require() map for the cat coat sheets. require() needs literal string
// paths, so each variant is listed explicitly. The PNGs are identical 16x19
// grids of 64px frames (see ./catalog).

import {type ImageSourcePropType} from 'react-native'

import {type CatVariant} from './catalog'

export const CAT_SHEETS: Record<CatVariant, ImageSourcePropType> = {
  cream: require('../../../../../assets/cats/cream.png'),
  black: require('../../../../../assets/cats/black.png'),
  grey: require('../../../../../assets/cats/grey.png'),
  'grey-white': require('../../../../../assets/cats/grey-white.png'),
  orange: require('../../../../../assets/cats/orange.png'),
  white: require('../../../../../assets/cats/white.png'),
}
