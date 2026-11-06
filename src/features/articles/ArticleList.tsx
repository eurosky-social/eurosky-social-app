import {Article} from './Article'
import {ArticleGrid, ArticleGridItem} from './ArticleGrid'
import {automaticArticleSize} from './ArticleGrid/layout'
import {type PostArticle} from './articles'

/** A chronological spread: presentation only, with no curation or data fetching. */
export function ArticleList({
  articles,
  wide = false,
}: {
  articles: readonly PostArticle[]
  wide?: boolean
}) {
  const sizes = articles.map((article, index) =>
    automaticArticleSize(article, index),
  )
  return (
    <ArticleGrid wide={wide} sizes={sizes}>
      {articles.map((article, index) => (
        <ArticleGridItem key={article.item.uri} size={sizes[index]} wide={wide}>
          <Article
            article={article}
            size={sizes[index]}
            lead={index === 0}
            compact={sizes[index] === 'small'}
            wide={wide}
          />
        </ArticleGridItem>
      ))}
    </ArticleGrid>
  )
}
