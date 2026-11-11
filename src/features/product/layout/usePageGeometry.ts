import {useWindowDimensions} from 'react-native'

import {useSession} from '#/state/session'
import {useLayoutBreakpoints} from '#/alf/breakpoints'
import {leftNavWidth, pageGeometry} from '#/config/layout'
import {PRODUCT} from '#/config/product'
import {IS_WEB} from '#/env'
import {usePageLayout} from './context'

/** Shared by center content, headers, spread borders, and the fixed right rail. */
export function usePageGeometry() {
  const {width: windowWidth} = useWindowDimensions()
  const {rightNavVisible, centerColumnOffset} = useLayoutBreakpoints()
  const {contentWidth} = usePageLayout()
  const {hasSession} = useSession()
  return pageGeometry({
    windowWidth,
    contentWidth: IS_WEB ? contentWidth : 'standard',
    rightNavVisible,
    centerColumnOffset,
    navWidth:
      IS_WEB && PRODUCT.layout.leftNav === 'pinned'
        ? leftNavWidth(windowWidth, {signedIn: hasSession})
        : undefined,
  })
}
