import {type NavigationConfig, validateNavigation} from '#/config/navigation'
import presets from '#/config/product-presets.json'

export type ProductId = keyof typeof presets

export type ProductConfig = {
  readonly id: ProductId
  readonly navigation: NavigationConfig
  readonly capabilities: {
    readonly messaging: boolean
    readonly standalonePosting: boolean
    readonly quotePosting: boolean
  }
}

/** Resolve build-time product selection without importing application state. */
export function getProduct(selection: string | undefined): ProductConfig {
  const id = selection ?? 'social'
  if (!Object.hasOwn(presets, id)) {
    throw new Error(
      `Unknown EXPO_PUBLIC_PRODUCT "${id}". Expected: ${Object.keys(presets).join(', ')}.`,
    )
  }
  const preset = presets[id as ProductId]
  validateNavigation(preset.navigation)
  return {id: id as ProductId, ...preset, navigation: preset.navigation}
}

/** Expo inlines this literal environment access into web and native bundles. */
export const PRODUCT = getProduct(process.env.EXPO_PUBLIC_PRODUCT)
