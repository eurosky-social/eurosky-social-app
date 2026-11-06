/** Hidden controls cannot receive pointer input or invisible keyboard focus. */
export function ShortsChrome({
  visible,
  children,
}: {
  visible: boolean
  children: React.ReactNode
}) {
  return (
    <div
      data-testid="shortsChrome"
      inert={!visible}
      aria-hidden={!visible}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity .2s ease-in-out',
      }}>
      {children}
    </div>
  )
}
