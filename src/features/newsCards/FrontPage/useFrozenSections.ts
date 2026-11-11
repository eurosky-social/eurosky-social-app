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

/** A section remembered by story URI, so it always shows the current posts. */
type FrozenSection = Omit<FrontSection, 'articles'> & {uris: string[]}

type Frozen = {
  /** Every URI seen so far; an unseen first story means the feed was refreshed. */
  known: Set<string>
  sections: FrozenSection[]
  /** All sections are built; until then only Top stories are frozen. */
  complete: boolean
  /** Latest in the order shown; new batches are appended. */
  latest: string[]
}

function newestFirst(articles: readonly PostArticle[]) {
  return [...articles].sort(
    (x, y) =>
      new Date(y.item.record.createdAt).getTime() -
      new Date(x.item.record.createdAt).getTime(),
  )
}

/** The News page has no sections: every story, newest first, in Latest. */
function build(
  articles: readonly PostArticle[],
  mode: 'discover' | 'following' | 'latest',
  shorts: boolean,
  now: Date,
  top?: PostArticle[],
): FrontSection[] {
  if (mode === 'discover')
    return buildDiscoverSections(articles, now, {shorts, top})
  if (mode === 'following') return buildFollowingSections(articles, now)
  return [{id: 'latest', kind: 'latest', articles: newestFirst(articles)}]
}

function freeze(sections: FrontSection[]): FrozenSection[] {
  return sections
    .filter(section => section.kind !== 'latest')
    .map(({articles, ...rest}) => ({
      ...rest,
      uris: articles.map(article => article.item.uri),
    }))
}

/**
 * Two stages, so the page shows at once without anything moving above the
 * fold: Top stories freeze from the first page, and the other sections are
 * built and frozen when the full window (or the end of the feed) arrives.
 * Sections hold URIs and are filled from the current feed, so muted, hidden or
 * deleted posts drop out. Latest keeps the order it was shown in and appends
 * each newly loaded batch. A refresh (an unseen first story) starts again.
 */
export function useFrozenSections(
  articles: readonly PostArticle[],
  mode: 'discover' | 'following' | 'latest',
  shorts: boolean,
  feedComplete = false,
): FrontSection[] {
  const [frozen, setFrozen] = useState<Frozen | undefined>()
  const byUri = new Map<string, PostArticle>(
    articles.map(article => [article.item.uri, article]),
  )
  const first = articles[0]?.item.uri
  const refreshed = !!frozen && !!first && !frozen.known.has(first)
  const current = refreshed ? undefined : frozen
  const now = new Date()
  const enoughForTop = articles.length >= TOP_AT || feedComplete
  const enoughForAll =
    mode !== 'discover' || articles.length >= SECTION_WINDOW || feedComplete

  if (!current && (!first || !enoughForTop)) {
    if (frozen) setFrozen(undefined)
    return build(articles, mode, shorts, now)
  }

  let next = current
  if (!next || (!next.complete && enoughForAll)) {
    const shownTop = next?.sections
      .find(section => section.kind === 'top')
      ?.uris.flatMap(uri => byUri.get(uri) ?? [])
    const built = build(articles, mode, shorts, now, shownTop)
    const sections = freeze(
      enoughForAll ? built : built.filter(section => section.kind === 'top'),
    )
    const claimed = new Set(sections.flatMap(section => section.uris))
    const latest = next
      ? next.latest.filter(uri => !claimed.has(uri))
      : newestFirst(articles.filter(a => !claimed.has(a.item.uri))).map(
          a => a.item.uri,
        )
    next = {
      known: new Set([...(next?.known ?? []), ...byUri.keys()]),
      sections,
      complete: enoughForAll,
      latest,
    }
  }

  const claimed = new Set(next.sections.flatMap(section => section.uris))
  const shownLatest = new Set(next.latest)
  const added = newestFirst(
    articles.filter(
      article =>
        !claimed.has(article.item.uri) && !shownLatest.has(article.item.uri),
    ),
  ).map(article => article.item.uri)
  if (added.length) {
    next = {
      ...next,
      known: new Set([...next.known, ...added]),
      latest: [...next.latest, ...added],
    }
  }
  if (next !== frozen) setFrozen(next)

  const present = (uris: readonly string[]) =>
    uris.flatMap(uri => byUri.get(uri) ?? [])
  return [
    ...next.sections.map(({uris, ...section}) => ({
      ...section,
      articles: present(uris),
    })),
    {id: 'latest', kind: 'latest', articles: present(next.latest)},
  ]
}
