import {type ArticleSize} from '../curation'

export type ArticleBand = {main: number; aside: number[]; columns: string}

/** Small stories pair up; a medium story can have one or two small companions. */
export function articleBands(sizes: ArticleSize[]): ArticleBand[] {
  const bands: ArticleBand[] = []
  for (let index = 0; index < sizes.length; index++) {
    const main = index
    const size = sizes[index]
    if (size === 'big') {
      bands.push({main, aside: [], columns: 'minmax(0, 1fr)'})
    } else if (size === 'medium') {
      const aside: number[] = []
      while (aside.length < 2 && sizes[index + 1] === 'small')
        aside.push(++index)
      bands.push({main, aside, columns: 'minmax(0, 2fr) minmax(0, 1fr)'})
    } else if (sizes[index + 1] === 'medium') {
      bands.push({
        main,
        aside: [++index],
        columns: 'minmax(0, 1fr) minmax(0, 2fr)',
      })
    } else {
      bands.push({
        main,
        aside: sizes[index + 1] === 'small' ? [++index] : [],
        columns: 'repeat(2, minmax(0, 1fr))',
      })
    }
  }
  return bands
}
