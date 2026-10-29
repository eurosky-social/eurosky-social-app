/** Native fallback; editorial profile sorting is currently web-only. */
export function StoryTransitions({
  children,
}: {
  children: React.ReactNode
  enabled: boolean
  layoutKey: string
}) {
  return children
}
