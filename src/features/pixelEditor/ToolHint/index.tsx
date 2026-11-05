/** Native tools expose their label through accessibility and long press. */
export function ToolHint({
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return <>{children}</>
}
