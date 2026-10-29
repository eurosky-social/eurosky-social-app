import {type EditorialArticle} from './articles'
import {
  type ArticleSize,
  type Curation,
  defaultCuration,
  MAX_CURATED_POSTS,
} from './curation'
import {type EditorialItem, type ResourceItem} from './items'

/** Repeating bands alternate a lead with companions, pairs, wide features and a reversed split. */
const SIZES: ArticleSize[] = [
  'medium',
  'small',
  'small',
  'small',
  'small',
  'big',
  'small',
  'medium',
  'small',
  'small',
  'medium',
  'small',
  'small',
  'big',
]

/** Only for repositories without a published layout. Editing snapshots these defaults, never the reverse. */
export function defaultLayout(
  articles: EditorialArticle[],
  starterPack?: ResourceItem,
): Curation {
  const items: EditorialItem[] = [...articles]
  if (starterPack && starterPack.kind === 'starterPack') {
    const position = Math.min(4, Math.max(1, items.length - 1))
    items.splice(position, 0, starterPack)
  }
  const slots = items.slice(0, MAX_CURATED_POSTS)
  return {
    ...defaultCuration(),
    order: slots.map(item => item.item.uri),
    sizes: slots.map((item, index) => ({
      post: item.item.uri,
      size: SIZES[index % SIZES.length],
    })),
  }
}
