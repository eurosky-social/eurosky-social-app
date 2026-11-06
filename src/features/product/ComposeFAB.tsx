import {FAB} from '#/view/com/util/fab/FAB'
import {PRODUCT} from '#/config/product'

/** Product-aware compose button; the generic FAB also serves non-post actions. */
export function ComposeFAB(props: React.ComponentProps<typeof FAB>) {
  if (!PRODUCT.capabilities.standalonePosting) return null
  return <FAB {...props} />
}
