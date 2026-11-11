import {useWindowDimensions} from 'react-native'

import {usePageGeometry} from '#/features/product/layout/usePageGeometry'
import {type Columns, columnsForWidth} from '../slotting'

/**
 * Columns follow the width the front page actually gets, so a wider shell adds
 * columns. The grid runs edge to edge in the page column, so that is the width.
 */
export function useFrontPageColumns(): Columns {
  const {width: windowWidth} = useWindowDimensions()
  const {width} = usePageGeometry()
  return columnsForWidth(Math.min(width, windowWidth))
}
