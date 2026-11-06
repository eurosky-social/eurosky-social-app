import {useState} from 'react'

import {type ArticleSize} from '../articles'
import {type ArticleBand, articleBands} from './layout'

/** Freeze visible bands on append; regroup only when existing stories or sizes change. */
export function useArticleBands(
  keys: string[],
  sizes: ArticleSize[],
): ArticleBand[] {
  const [layout, setLayout] = useState(() => ({
    keys,
    sizes,
    bands: articleBands(sizes),
  }))
  const appendOnly =
    layout.keys.length <= keys.length &&
    layout.keys.every(
      (key, index) =>
        key === keys[index] && layout.sizes[index] === sizes[index],
    )

  if (appendOnly && layout.keys.length === keys.length) return layout.bands

  const start = appendOnly ? layout.keys.length : 0
  const addedBands = articleBands(sizes.slice(start)).map(band => ({
    ...band,
    main: band.main + start,
    aside: band.aside.map(index => index + start),
  }))
  const next = {
    keys,
    sizes,
    bands: appendOnly ? [...layout.bands, ...addedBands] : addedBands,
  }
  setLayout(next)
  return next.bands
}
