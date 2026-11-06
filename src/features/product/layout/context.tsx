import {createContext, useContext} from 'react'

import {type PageLayout, resolvePageLayout} from '#/config/layout'
import {PRODUCT} from '#/config/product'
import {NEWS_V2_ENABLED} from '#/features/newsFeed/config'

const PageLayoutContext = createContext<PageLayout | undefined>(undefined)

/** Also scope cached stack scenes, so they never inherit the active route's geometry. */
export function PageLayoutProvider({
  routeName,
  params,
  children,
}: {
  routeName: string
  params?: {view?: string}
  children: React.ReactNode
}) {
  const value = resolvePageLayout(
    PRODUCT.layout,
    routeName,
    params,
    NEWS_V2_ENABLED,
  )
  return <PageLayoutContext value={value}>{children}</PageLayoutContext>
}

export function usePageLayout() {
  return useContext(PageLayoutContext) ?? resolvePageLayout(PRODUCT.layout, '')
}
