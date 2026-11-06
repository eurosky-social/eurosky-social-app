/** Keep desktop tool labels discoverable without adding text to the toolbar. */
export function ToolHint({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return <div title={label}>{children}</div>
}
