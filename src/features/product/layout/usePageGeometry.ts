import {useWindowDimensions} from 'react-native'

import {useLayoutBreakpoints} from '#/alf/breakpoints'
import {pageGeometry} from '#/config/layout'
import {IS_WEB} from '#/env'
import {usePageLayout} from './context'

/** Shared by center content, headers, spread borders, and the fixed right rail. */
export function usePageGeometry() {
  const {width: windowWidth} = useWindowDimensions()
  const {rightNavVisible, centerColumnOffset} = useLayoutBreakpoints()
  const {contentWidth} = usePageLayout()
  return pageGeometry({
    windowWidth,
    contentWidth: IS_WEB ? contentWidth : 'standard',
    rightNavVisible,
    centerColumnOffset,
  })
}
