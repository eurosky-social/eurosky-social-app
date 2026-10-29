export type SortableStoriesProps = {
  children: React.ReactNode
  enabled: boolean
  order: string[]
  layoutKey?: string
  onReorder: (source: string, target: string, edge: 'before' | 'after') => void
}

export type SortableStoryProps = {
  uri: string
  children: React.ReactNode
}

export type StoryDragHandleProps = {
  uri: string
  title: string
}
