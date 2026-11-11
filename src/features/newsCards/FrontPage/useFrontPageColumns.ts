import {useWindowDimensions} from 'react-native'

import {usePageGeometry} from '#/features/product/layout/usePageGeometry'
import {type Columns, columnsForWidth} from '../slotting'

/** Horizontal padding around the front page, matching `a.px_lg` on each side. */
export const FRONT_PAGE_GUTTER = 16

/** Columns follow the width the front page actually gets, so a wider shell adds columns. */
export function useFrontPageColumns(): Columns {
  const {width: windowWidth} = useWindowDimensions()
  const {width} = usePageGeometry()
  return columnsForWidth(Math.min(width, windowWidth) - 2 * FRONT_PAGE_GUTTER)
}
