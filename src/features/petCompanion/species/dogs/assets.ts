// Static require() map for the dog sheets. require() needs literal string
// paths, so each breed is listed explicitly. Every sheet is a grid of 64px
// frames with one animation per row (see ./catalog for each breed's geometry).

import {type ImageSourcePropType} from 'react-native'

export const DOG_SHEETS: Record<string, ImageSourcePropType> = {
  'cane-corso': require('../../../../../assets/pets/dogs/cane-corso.png'),
  dalmatian: require('../../../../../assets/pets/dogs/dalmatian.png'),
  'dogo-argentino': require('../../../../../assets/pets/dogs/dogo-argentino.png'),
  'golden-retriever': require('../../../../../assets/pets/dogs/golden-retriever.png'),
  husky: require('../../../../../assets/pets/dogs/husky.png'),
  'pharaoh-hound': require('../../../../../assets/pets/dogs/pharaoh-hound.png'),
  rottweiler: require('../../../../../assets/pets/dogs/rottweiler.png'),
}

// The Labrador pack ships three coat variants as pre-combined sheets.
export const LABRADOR_SHEETS: Record<
  'ruby' | 'blond' | 'reddish',
  ImageSourcePropType
> = {
  ruby: require('../../../../../assets/pets/dogs/labrador-ruby.png'),
  blond: require('../../../../../assets/pets/dogs/labrador-blond.png'),
  reddish: require('../../../../../assets/pets/dogs/labrador-reddish.png'),
}
