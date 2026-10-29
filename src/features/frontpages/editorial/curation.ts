import {isDidString} from '@atproto/lex'
import {z} from 'zod'

import {articleLinkKey} from './articleLinks'
import {type EditorialArticle} from './articles'

export const FRONTPAGE_COLLECTION = 'social.mu.frontpage'
export const MAX_CURATED_POSTS = 100

export type ArticleSize = 'small' | 'medium' | 'big'
export type StarterPackViewMode = 'people' | 'posts'
export type Curation = {
  starterPackViews?: {uri: string; view: StarterPackViewMode}[]
  sizes?: {post: string; size: ArticleSize}[]
  leadPost?: string
  order: string[]
  hidden: string[]
  includeLatest: boolean
}

export function defaultCuration(): Curation {
  return {order: [], hidden: [], includeLatest: true}
}

export function referenceKind(
  uri: string,
): 'article' | 'feed' | 'starterPack' | undefined {
  if (/^at:\/\/did:[^/]+\/app\.bsky\.feed\.post\/[^/]+$/.test(uri))
    return 'article'
  if (/^at:\/\/did:[^/]+\/app\.bsky\.feed\.generator\/[^/]+$/.test(uri))
    return 'feed'
  if (/^at:\/\/did:[^/]+\/app\.bsky\.graph\.starterpack\/[^/]+$/.test(uri))
    return 'starterPack'
}

/** Posts must be the publisher's own; feeds and starter packs may be curated from other creators. */
export function isAllowedSlotUri(uri: string, did: string) {
  const kind = referenceKind(uri)
  if (kind === 'article') return isOwnPostUri(uri, did)
  if (!kind) return false
  const author = uri.slice('at://'.length).split('/')[0]
  if (!isDidString(author)) return false
  const collection =
    kind === 'feed' ? 'app.bsky.feed.generator' : 'app.bsky.graph.starterpack'
  return isOwnPostUri(
    uri.replace(`/${collection}/`, '/app.bsky.feed.post/'),
    author,
  )
}

/** A public layout can only refer to posts belonging to its repository. */
export function isOwnPostUri(uri: string, did: string) {
  const prefix = `at://${did}/app.bsky.feed.post/`
  const rkey = uri.startsWith(prefix) ? uri.slice(prefix.length) : ''
  return /^[A-Za-z0-9._~:-]{1,512}$/.test(rkey) && rkey !== '.' && rkey !== '..'
}

export function curationRecordSchema(did: string) {
  const uri = z
    .string()
    .max(2048)
    .refine(value => isAllowedSlotUri(value, did))
  const posts = z
    .array(uri)
    .max(MAX_CURATED_POSTS)
    .refine(values => new Set(values).size === values.length)
  return z
    .object({
      $type: z.literal(FRONTPAGE_COLLECTION),
      version: z.literal(1),
      leadPost: uri.optional(),
      starterPackViews: z
        .array(
          z.object({
            uri: uri.refine(value => referenceKind(value) === 'starterPack'),
            view: z.enum(['people', 'posts']),
          }),
        )
        .max(MAX_CURATED_POSTS)
        .refine(
          values =>
            new Set(values.map(value => value.uri)).size === values.length,
        )
        .optional(),
      sizes: z
        .array(z.object({post: uri, size: z.enum(['small', 'medium', 'big'])}))
        .max(MAX_CURATED_POSTS)
        .refine(
          values =>
            new Set(values.map(value => value.post)).size === values.length,
        )
        .optional(),
      order: posts,
      hidden: posts,
      includeLatest: z.boolean(),
      updatedAt: z.string().datetime(),
    })
    .refine(
      value =>
        !value.hidden.some(post => value.order.includes(post)) &&
        (!value.leadPost ||
          (!value.hidden.includes(value.leadPost) &&
            value.order.includes(value.leadPost))),
    )
}

/** Curated posts precede new arrivals; hidden/deleted/moderated posts never win a slot. */
export function curateItems<T extends {item: {uri: string}; url?: string}>(
  articles: T[],
  curation: Curation,
) {
  const byUri = new Map<string, T>(
    articles.map(article => [article.item.uri, article]),
  )
  const hidden = new Set(curation.hidden)
  const picked = new Set(curation.order)
  const candidates = [
    ...(curation.leadPost ? [byUri.get(curation.leadPost)] : []),
    ...curation.order.map(uri => byUri.get(uri)),
    ...(curation.includeLatest
      ? articles.filter(article => !picked.has(article.item.uri))
      : []),
  ]
  const seen = new Set<string>()
  return candidates.filter((article): article is T => {
    if (!article || hidden.has(article.item.uri)) return false
    const key = article.url ? articleLinkKey(article.url) : article.item.uri
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function curateArticles(
  articles: EditorialArticle[],
  curation: Curation,
) {
  return curateItems(articles, curation)
}

/** Insert at the chosen boundary without losing older saved references or duplicating a slot. */
export function insertItem(
  curation: Curation,
  visible: string[],
  uri: string,
  before: string | null,
): Curation {
  if (before === uri) return curation
  if (before !== null && !visible.includes(before))
    throw new Error('InsertionPointUnavailable')
  const order = visible.filter(value => value !== uri)
  order.splice(before === null ? order.length : order.indexOf(before), 0, uri)
  return {
    ...withVisibleOrder(curation, order),
    hidden: curation.hidden.filter(value => value !== uri),
    leadPost: order[0],
  }
}

/** Retain saved references not in this feed page instead of silently dropping older picks. */
function withVisibleOrder(curation: Curation, visible: string[]) {
  const order = [...new Set([...visible, ...curation.order])]
  if (order.length > MAX_CURATED_POSTS) throw new Error('CurationLimit')
  return {...curation, order}
}

export function setLeadPost(curation: Curation, uri: string): Curation {
  const next = withVisibleOrder(curation, [uri])
  return {
    ...next,
    leadPost: uri,
    hidden: next.hidden.filter(post => post !== uri),
  }
}

export function reorderPosts(
  curation: Curation,
  visible: string[],
  source: string,
  target: string,
  edge: 'before' | 'after',
): Curation {
  if (
    source === target ||
    !visible.includes(source) ||
    !visible.includes(target)
  )
    return curation
  const order = visible.filter(uri => uri !== source)
  order.splice(order.indexOf(target) + (edge === 'after' ? 1 : 0), 0, source)
  if (order.every((uri, index) => uri === visible[index])) return curation
  return {...withVisibleOrder(curation, order), leadPost: order[0]}
}

export function articleSize(
  curation: Curation,
  uri: string,
  lead: boolean,
): ArticleSize {
  const size = curation.sizes?.find(value => value.post === uri)?.size
  return lead ? (size === 'big' ? 'big' : 'medium') : (size ?? 'small')
}

export function setArticleSize(
  curation: Curation,
  uri: string,
  size: ArticleSize,
): Curation {
  const sizes = [
    ...(curation.sizes ?? []).filter(value => value.post !== uri),
    {post: uri, size},
  ]
  if (sizes.length > MAX_CURATED_POSTS) throw new Error('CurationLimit')
  return {...curation, sizes}
}

export function starterPackView(
  curation: Curation,
  uri: string,
): StarterPackViewMode {
  return (
    curation.starterPackViews?.find(value => value.uri === uri)?.view ??
    'people'
  )
}

export function setStarterPackView(
  curation: Curation,
  uri: string,
  view: StarterPackViewMode,
): Curation {
  const views = [
    ...(curation.starterPackViews ?? []).filter(value => value.uri !== uri),
    {uri, view},
  ]
  if (views.length > MAX_CURATED_POSTS) throw new Error('CurationLimit')
  return {...curation, starterPackViews: views}
}

export function hidePost(curation: Curation, uri: string): Curation {
  const hidden =
    referenceKind(uri) === 'article'
      ? [...new Set([...curation.hidden, uri])]
      : curation.hidden.filter(value => value !== uri)
  if (hidden.length > MAX_CURATED_POSTS) throw new Error('CurationLimit')
  return {
    ...curation,
    hidden,
    order: curation.order.filter(post => post !== uri),
    leadPost: curation.leadPost === uri ? undefined : curation.leadPost,
  }
}

export function restorePost(curation: Curation, uri: string): Curation {
  const next = withVisibleOrder(curation, [...curation.order, uri])
  return {...next, hidden: next.hidden.filter(post => post !== uri)}
}

export function setIncludeLatest(
  curation: Curation,
  includeLatest: boolean,
  visible: string[],
): Curation {
  return {
    ...(includeLatest ? curation : withVisibleOrder(curation, visible)),
    includeLatest,
  }
}
