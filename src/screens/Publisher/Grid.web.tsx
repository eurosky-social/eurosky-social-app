export function PublisherGrid({
  children,
  wide,
}: {
  children: React.ReactNode
  wide: boolean
}) {
  return (
    <div
      data-testid="publisherDirectoryList"
      style={{
        display: 'grid',
        gridTemplateColumns: wide
          ? 'repeat(2, minmax(0, 1fr))'
          : 'minmax(0, 1fr)',
        gap: 16,
        padding: 16,
      }}>
      {children}
    </div>
  )
}
