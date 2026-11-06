import {type ArticleSize} from '../articles'
import {type ArticleBand} from './layout'

export type ArticleGridProps = {
  children: React.ReactNode
  wide: boolean
  sizes: ArticleSize[]
  /** Optional stable grouping for append-only reader lists; editors regroup by default. */
  bands?: readonly ArticleBand[]
  renderInsert?: (index: number, beside: boolean) => React.ReactNode
}
export type ArticleGridItemProps = {
  children: React.ReactNode
  wide: boolean
  size: ArticleSize
}
