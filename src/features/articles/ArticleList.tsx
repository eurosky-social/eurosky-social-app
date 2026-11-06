import {Article} from './Article'
import {ArticleGrid, ArticleGridItem} from './ArticleGrid'
import {automaticArticleSize} from './ArticleGrid/layout'
import {useArticleBands} from './ArticleGrid/useArticleBands'
import {type PostArticle} from './articles'

/** A chronological spread: presentation only, with no curation or data fetching. */
export function ArticleList({
  articles,
  wide = false,
  renderByline,
  density = 'default',
  offset = 0,
}: {
  articles: readonly PostArticle[]
  wide?: boolean
  renderByline?: (article: PostArticle) => React.ReactNode
  density?: 'default' | 'compact'
  /** Preserve the collection rhythm when inserting an independent section between lists. */
  offset?: number
}) {
  const sizes = articles.map((article, index) =>
    automaticArticleSize(article, index + offset),
  )
  const bands = useArticleBands(
    articles.map(article => article.item.uri),
    sizes,
  )
  return (
    <ArticleGrid wide={wide} sizes={sizes} bands={bands}>
      {articles.map((article, index) => (
        <ArticleGridItem key={article.item.uri} size={sizes[index]} wide={wide}>
          <Article
            article={article}
            linkTo="post"
            size={sizes[index]}
            lead={index + offset === 0}
            compact={sizes[index] === 'small'}
            wide={wide}
            byline={renderByline?.(article)}
            dense={density === 'compact'}
          />
        </ArticleGridItem>
      ))}
    </ArticleGrid>
  )
}
