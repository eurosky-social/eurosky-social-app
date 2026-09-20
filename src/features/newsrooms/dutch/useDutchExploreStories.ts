import {useMemo} from 'react'

import {EXPLORE_SECTION_OTHER, type ExploreSection} from '../explore/sections'
import {adaptStory, type DutchExploreStory, themeSections} from './adapt'
import {useDutchStoriesQuery, useDutchThemesQuery} from './queries'

/**
 * The labeler's stories in the shape the spread renders, alongside the sections
 * to lay them out under.
 *
 * Same shape as `useExploreStories`, so the two sources are interchangeable
 * behind one page. Nothing clusters or searches for posts here because the
 * service has already done both.
 *
 * Sections come from the API rather than from `EXPLORE_SECTIONS`, so they are
 * returned rather than imported by the page.
 */
export function useDutchExploreStories({
  theme,
  category,
}: {theme?: string; category?: string} = {}): {
  stories: DutchExploreStory[]
  sections: ExploreSection[]
  isLoading: boolean
} {
  const {stories: raw, isLoading: storiesLoading} = useDutchStoriesQuery({
    theme,
    category,
  })
  const {themes, isLoading: themesLoading} = useDutchThemesQuery({category})

  const sections = useMemo(() => themeSections(themes), [themes])

  const stories = useMemo(() => {
    const bySlug = new Map(sections.map(section => [section.id, section]))
    const sectionForTheme = (slug: string | null) =>
      (slug ? bySlug.get(slug) : undefined) ?? EXPLORE_SECTION_OTHER

    /*
     * A story whose articles have aged out of the archive maps to nothing, so
     * the page never has to render a card with no lead.
     */
    return raw
      .map(story => adaptStory(story, sectionForTheme))
      .filter((story): story is DutchExploreStory => story !== undefined)
  }, [raw, sections])

  return {
    stories,
    sections,
    isLoading: storiesLoading || themesLoading,
  }
}
