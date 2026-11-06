import {type PostArticle} from './articles'

/** Ignore typographic/whitespace differences and the article's own trailing URL. */
function comparable(text: string) {
  return text
    .normalize('NFKC')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/gu, ' ')
    .trim()
}

/** Metadata is already visible; retain the caption only when it adds different copy. */
export function hasDistinctArticleCaption(
  article: Pick<PostArticle, 'item' | 'url' | 'title' | 'description'>,
) {
  const text = comparable(
    article.url
      ? article.item.record.text.split(article.url).join('')
      : article.item.record.text,
  )
  if (!text) return false
  return ![
    article.title,
    article.description,
    `${article.title} ${article.description}`,
  ].some(value => comparable(value) === text)
}
