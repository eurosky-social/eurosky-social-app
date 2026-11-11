import {useState} from 'react'

import {type PostArticle} from '#/features/articles/articles'
import {
  buildDiscoverSections,
  buildFollowingSections,
  type FrontSection,
} from '../sections'

/** Freeze once this many stories have loaded, so sections do not reshuffle as pages arrive. */
const FREEZE_AT = 20

type Frozen = {
  first: string
  sections: FrontSection[]
  claimed: Set<string>
}

function build(
  articles: readonly PostArticle[],
  mode: 'discover' | 'following',
  shorts: boolean,
) {
  const now = new Date()
  return mode === 'discover'
    ? buildDiscoverSections(articles, now, {shorts})
    : buildFollowingSections(articles, now)
}

function newestFirst(articles: readonly PostArticle[]) {
  return [...articles].sort(
    (x, y) =>
      new Date(y.item.record.createdAt).getTime() -
      new Date(x.item.record.createdAt).getTime(),
  )
}

/**
 * Build the sections once enough stories have loaded and keep them until the
 * feed is refreshed (its first story changes). Only Latest keeps growing.
 */
export function useFrozenSections(
  articles: readonly PostArticle[],
  mode: 'discover' | 'following',
  shorts: boolean,
  complete = false,
): FrontSection[] {
  const [frozen, setFrozen] = useState<Frozen | undefined>()
  const first = articles[0]?.item.uri
  const current = frozen && frozen.first === first ? frozen : undefined

  if (!current) {
    const sections = build(articles, mode, shorts)
    if (first && (articles.length >= FREEZE_AT || complete)) {
      const kept = sections.filter(section => section.kind !== 'latest')
      setFrozen({
        first,
        sections: kept,
        claimed: new Set(
          kept.flatMap(section => section.articles.map(a => a.item.uri)),
        ),
      })
    } else if (frozen) {
      setFrozen(undefined)
    }
    return sections
  }

  return [
    ...current.sections,
    {
      id: 'latest',
      kind: 'latest',
      articles: newestFirst(
        articles.filter(article => !current.claimed.has(article.item.uri)),
      ),
    },
  ]
}
