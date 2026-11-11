import {useState} from 'react'

import {type PostArticle} from '#/features/articles/articles'
import {
  buildDiscoverSections,
  buildFollowingSections,
  type FrontSection,
  SECTION_WINDOW,
} from '../sections'

/** Top stories freeze once this many stories have loaded. */
const TOP_AT = 20

type Frozen = {
  first: string
  /** Sections above Latest; Top stories only until the full window lands. */
  sections: FrontSection[]
  /** All sections are built; nothing above Latest changes until a refresh. */
  complete: boolean
}

function newestFirst(articles: readonly PostArticle[]) {
  return [...articles].sort(
    (x, y) =>
      new Date(y.item.record.createdAt).getTime() -
      new Date(x.item.record.createdAt).getTime(),
  )
}

function withLatest(
  sections: FrontSection[],
  articles: readonly PostArticle[],
): FrontSection[] {
  const claimed = new Set(
    sections.flatMap(section => section.articles.map(a => a.item.uri)),
  )
  return [
    ...sections,
    {
      id: 'latest',
      kind: 'latest',
      articles: newestFirst(
        articles.filter(article => !claimed.has(article.item.uri)),
      ),
    },
  ]
}

/**
 * Two stages, so the page shows at once without anything moving above the
 * fold: Top stories freeze from the first page, and the other sections are
 * built and frozen when the full window (or the end of the feed) arrives,
 * keeping that Top stories block. Only Latest grows after that. A refresh
 * (a new first story) starts again.
 */
export function useFrozenSections(
  articles: readonly PostArticle[],
  mode: 'discover' | 'following',
  shorts: boolean,
  feedComplete = false,
): FrontSection[] {
  const [frozen, setFrozen] = useState<Frozen | undefined>()
  const first = articles[0]?.item.uri
  const current = frozen && frozen.first === first ? frozen : undefined
  const now = new Date()
  const enoughForTop = articles.length >= TOP_AT || feedComplete
  const enoughForAll = articles.length >= SECTION_WINDOW || feedComplete

  if (current?.complete) return withLatest(current.sections, articles)

  if (!first || !enoughForTop) {
    if (frozen) setFrozen(undefined)
    return mode === 'discover'
      ? buildDiscoverSections(articles, now, {shorts})
      : buildFollowingSections(articles, now)
  }

  if (mode === 'following') {
    const sections = buildFollowingSections(articles, now).filter(
      section => section.kind !== 'latest',
    )
    setFrozen({first, sections, complete: true})
    return withLatest(sections, articles)
  }

  const top = current?.sections.find(section => section.kind === 'top')
  if (enoughForAll) {
    const sections = buildDiscoverSections(articles, now, {
      shorts,
      top: top?.articles,
    }).filter(section => section.kind !== 'latest')
    setFrozen({first, sections, complete: true})
    return withLatest(sections, articles)
  }

  if (current) return withLatest(current.sections, articles)
  const topOnly = buildDiscoverSections(articles, now, {shorts}).filter(
    section => section.kind === 'top',
  )
  setFrozen({first, sections: topOnly, complete: false})
  return withLatest(topOnly, articles)
}
