import {useMemo} from 'react'
import {useMediaQuery} from 'react-responsive'

import {type Breakpoint, BREAKPOINTS} from '#/alf/breakpoints.shared'
import {PRODUCT} from '#/config/product'
import {usePageLayout} from '#/features/product/layout/context'

export {type Breakpoint, BreakpointWidthContext} from '#/alf/breakpoints.shared'

export function useBreakpoints(): Record<Breakpoint, boolean> & {
  activeBreakpoint: Breakpoint | undefined
} {
  const gtPhone = useMediaQuery({minWidth: BREAKPOINTS.phone})
  const gtMobile = useMediaQuery({minWidth: BREAKPOINTS.mobile})
  const gtTablet = useMediaQuery({minWidth: BREAKPOINTS.tablet})
  return useMemo(() => {
    let active: Breakpoint | undefined
    if (gtTablet) {
      active = 'gtTablet'
    } else if (gtMobile) {
      active = 'gtMobile'
    } else if (gtPhone) {
      active = 'gtPhone'
    }
    return {
      activeBreakpoint: active,
      gtPhone,
      gtMobile,
      gtTablet,
    }
  }, [gtPhone, gtMobile, gtTablet])
}

/**
 * Fine-tuned breakpoints for the shell layout
 */
export function useLayoutBreakpoints() {
  const rightNavAvailable = useMediaQuery({minWidth: BREAKPOINTS.rightNav})
  const {rightSidebar} = usePageLayout()
  const rightNavVisible = rightNavAvailable && rightSidebar !== 'hidden'
  /* A pinned left nav centres content beside itself, so the tablet shift is off. */
  const tabletShift = useMediaQuery({
    minWidth: BREAKPOINTS.rightNav,
    maxWidth: BREAKPOINTS.tablet,
  })
  const centerColumnOffset = tabletShift && PRODUCT.layout.leftNav !== 'pinned'
  const leftNavMinimal = useMediaQuery({maxWidth: BREAKPOINTS.tablet})

  return {
    rightNavVisible,
    centerColumnOffset,
    leftNavMinimal,
  }
}
