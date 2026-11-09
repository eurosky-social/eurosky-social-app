import {
  type SortableStoriesProps,
  type SortableStoryProps,
  type StoryDragHandleProps,
} from './types'

/** Editorial profiles currently only render on web. */
export function SortableStories({children}: SortableStoriesProps) {
  return children
}

export function SortableStory({children}: SortableStoryProps) {
  return children
}

export function StoryDragHandle(_props: StoryDragHandleProps) {
  return null
}
