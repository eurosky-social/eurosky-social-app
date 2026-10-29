import {type ArticleSize} from '../curation'

export type ArticleGridProps = {
  children: React.ReactNode
  wide: boolean
  sizes: ArticleSize[]
  renderInsert?: (index: number, beside: boolean) => React.ReactNode
}
export type ArticleGridItemProps = {
  children: React.ReactNode
  wide: boolean
  size: ArticleSize
}
