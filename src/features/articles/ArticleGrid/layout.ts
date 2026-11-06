import {type ArticleSize, type PostArticle} from '../articles'

/** Shared automatic rhythm: lead/companions, pairs, full-width features and reversed splits. */
const DEFAULT_SIZES: readonly ArticleSize[] = [
  'medium',
  'small',
  'small',
  'small',
  'small',
  'big',
  'small',
  'small',
  'medium',
  'small',
  'small',
  'medium',
  'small',
  'small',
  'big',
]

export function defaultArticleSize(position: number): ArticleSize {
  return DEFAULT_SIZES[position % DEFAULT_SIZES.length]
}

/** A bare post should not leave an empty hero column beside two illustrated stories. */
export function automaticArticleSize(
  article: Pick<PostArticle, 'external' | 'image' | 'media' | 'quote'>,
  position: number,
): ArticleSize {
  return !article.image &&
    !article.media &&
    !article.quote &&
    !article.external?.title.trim()
    ? 'big'
    : defaultArticleSize(position)
}

export type ArticleBand = {
  main: number
  aside: number[]
  columns: string
  reversed?: boolean
}

/** Reversed features follow their two companions in both visual and DOM reading order. */
export function articleBands(sizes: ArticleSize[]): ArticleBand[] {
  const bands: ArticleBand[] = []
  for (let index = 0; index < sizes.length; index++) {
    const main = index
    const size = sizes[index]
    if (size === 'big') {
      bands.push({main, aside: [], columns: 'minmax(0, 1fr)'})
    } else if (
      size === 'small' &&
      sizes[index + 1] === 'small' &&
      sizes[index + 2] === 'medium'
    ) {
      bands.push({
        main: index + 2,
        aside: [index, index + 1],
        columns: 'minmax(0, 1fr) minmax(0, 2fr)',
        reversed: true,
      })
      index += 2
    } else if (size === 'medium') {
      const aside: number[] = []
      while (aside.length < 2 && sizes[index + 1] === 'small')
        aside.push(++index)
      bands.push({
        main,
        aside,
        columns: aside.length
          ? 'minmax(0, 2fr) minmax(0, 1fr)'
          : 'minmax(0, 1fr)',
      })
    } else {
      const aside =
        sizes[index + 1] === 'small' || sizes[index + 1] === 'medium'
          ? [++index]
          : []
      bands.push({
        main,
        aside,
        columns: aside.length ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)',
      })
    }
  }
  return bands
}
