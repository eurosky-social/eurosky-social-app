import {useWindowDimensions} from 'react-native'

import {PRODUCT, type ProductConfig} from '#/config/product'

/** Inline news media, including comments/quotes. Immersive feeds and lightboxes remain full-screen. */
export function postMediaMaxHeight(
  windowHeight: number,
  product: ProductConfig = PRODUCT,
) {
  return product.id === 'news' ? windowHeight * 0.8 : undefined
}
export function usePostMediaMaxHeight() {
  const {height} = useWindowDimensions()
  return postMediaMaxHeight(height)
}
