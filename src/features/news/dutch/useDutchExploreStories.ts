import {useMemo} from 'react'

import {mergeRanked} from '../explore/interests'
import {EXPLORE_SECTION_OTHER, type ExploreSection} from '../explore/sections'
import {adaptThread, type DutchExploreStory, themeSections} from './adapt'
import {
  type DutchThreadFilter,
  THREADS_LIMIT,
  useDutchThemesQuery,
  useDutchThreadsQueries,
} from './queries'
import {type DutchThreadSort} from './types'

/**
 * The labeler's threads in the shape the spread renders, alongside the
 * sections to lay them out under.
 *
 * Same shape as `useExploreStories`, so the two sources are interchangeable
 * behind one page. Nothing clusters or searches for posts here because the
 * service has already done both.
 *
 * Sections come from the API rather than from `EXPLORE_SECTIONS`, so they are
 * returned rather than imported by the page.
 *
 * The reader's languages, places and outlets are applied by the service too
 * (see `DutchThreadView`), so nothing is filtered here either.
 */
export function useDutchExploreStories({
  scope,
  filters,
  languages,
  sort,
  enabled = true,
}: {
  scope?: string
  /**
   * The reads that make up the page, merged rank by rank with boosted
   * threads first (see `mergeRanked`). Empty reads nothing.
   */
  filters: DutchThreadFilter[]
  /**
   * ISO language codes; only threads with an article in one are read, and
   * only those articles shown.
   */
  languages?: string[]
  /** How the service ranks each read; its own `burst` by default. */
  sort?: DutchThreadSort
  enabled?: boolean
}): {
  stories: DutchExploreStory[]
  sections: ExploreSection[]
  isLoading: boolean
  /** The threads could not be read, as opposed to there being none. */
  isError: boolean
} {
  const {
    threadLists,
    views,
    isLoading: storiesLoading,
    error,
  } = useDutchThreadsQueries({scope, filters, languages, sort, enabled})
  /* The sections are every theme: a page of several reads spans them all. */
  const {themes, isLoading: themesLoading} = useDutchThemesQuery({
    scope,
    enabled,
  })

  const sections = useMemo(() => themeSections(themes), [themes])
  const listsKey = threadLists
    .map(list => list.map(thread => thread.id).join(','))
    .join('|')
  const viewsKey = views.join('|')

  const stories = useMemo(() => {
    const bySlug = new Map(sections.map(section => [section.id, section]))
    const sectionForTheme = (slug: string | null) =>
      (slug ? bySlug.get(slug) : undefined) ?? EXPLORE_SECTION_OTHER

    /*
     * Two reads can return the same thread; it shows once, in the view of the
     * read that ranked it first.
     */
    const entries = mergeRanked(
      threadLists.map((list, index) =>
        list.map(thread => ({
          id: thread.key,
          boosted: thread.boosted,
          thread,
          view: views[index],
        })),
      ),
    )
    /*
     * A thread whose articles have aged out of the archive maps to nothing, so
     * the page never has to render a card with no lead.
     */
    return entries
      .map(({thread, view}) => adaptThread(thread, sectionForTheme, view))
      .filter((story): story is DutchExploreStory => story !== undefined)
      .slice(0, THREADS_LIMIT)
    /* Keyed on the lists' contents: the queries hand back fresh arrays. */
  }, [listsKey, viewsKey, sections]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    stories,
    sections,
    isLoading: storiesLoading || themesLoading,
    isError: !!error,
  }
}
