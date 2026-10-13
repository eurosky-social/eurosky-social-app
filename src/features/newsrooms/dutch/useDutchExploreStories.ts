import {useMemo} from 'react'

import {mergeRanked} from '../explore/interests'
import {EXPLORE_SECTION_OTHER, type ExploreSection} from '../explore/sections'
import {
  adaptThread,
  type DutchExploreStory,
  isThreadInLanguages,
  themeSections,
} from './adapt'
import {
  type DutchThreadFilter,
  THREADS_LIMIT,
  useDutchThemesQuery,
  useDutchThreadsQueries,
} from './queries'

/**
 * How many threads to read when several languages filter them on the client.
 * The service filters by one language only, so with more the page reads a
 * wider page of threads and keeps those in any of them.
 */
const MULTI_LANGUAGE_LIMIT = 100

/** A stable empty default, so the memo below is not rebuilt every render. */
const NO_LANGUAGES: string[] = []

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
 */
export function useDutchExploreStories({
  scope,
  filters,
  languages = NO_LANGUAGES,
  enabled = true,
}: {
  scope?: string
  /**
   * The reads that make up the page, merged rank by rank (see `mergeRanked`).
   * Empty reads nothing.
   */
  filters: DutchThreadFilter[]
  /** ISO language codes; only threads with an article in one are kept. */
  languages?: string[]
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
    isLoading: storiesLoading,
    error,
  } = useDutchThreadsQueries({
    scope,
    filters,
    /* One language the service filters itself, and picks a lead in. */
    lang: languages.length === 1 ? languages[0] : undefined,
    limit: languages.length > 1 ? MULTI_LANGUAGE_LIMIT : THREADS_LIMIT,
    enabled,
  })
  /* The sections are every theme: a page of several reads spans them all. */
  const {themes, isLoading: themesLoading} = useDutchThemesQuery({
    scope,
    enabled,
  })

  const sections = useMemo(() => themeSections(themes), [themes])
  const listsKey = threadLists
    .map(list => list.map(thread => thread.id).join(','))
    .join('|')

  const stories = useMemo(() => {
    const bySlug = new Map(sections.map(section => [section.id, section]))
    const sectionForTheme = (slug: string | null) =>
      (slug ? bySlug.get(slug) : undefined) ?? EXPLORE_SECTION_OTHER

    /* Two reads can return the same thread; it shows once. */
    const threads = mergeRanked(
      threadLists.map(list => list.map(thread => ({id: thread.key, thread}))),
    ).map(entry => entry.thread)
    /*
     * A thread whose articles have aged out of the archive maps to nothing, so
     * the page never has to render a card with no lead.
     */
    return threads
      .filter(
        thread =>
          languages.length === 0 || isThreadInLanguages(thread, languages),
      )
      .map(thread => adaptThread(thread, sectionForTheme, languages))
      .filter((story): story is DutchExploreStory => story !== undefined)
      .slice(0, THREADS_LIMIT)
    /* Keyed on the lists' contents: the queries hand back fresh arrays. */
  }, [listsKey, sections, languages]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    stories,
    sections,
    isLoading: storiesLoading || themesLoading,
    isError: !!error,
  }
}
