import {useEffect, useRef} from 'react'

const styles = `
@media (hover: hover) and (pointer: fine) {
  [data-testid="editorialFrontpage"] [data-testid="articleControls"],
  [data-testid="editorialFrontpage"] [data-testid="insertFrontpageSlot"] {
    opacity: 0;
    transition: opacity 120ms ease;
  }
  [data-testid="editorialFrontpage"] [data-editorial-story]:hover [data-testid="articleControls"],
  [data-testid="editorialFrontpage"] [data-editorial-story]:focus-within [data-testid="articleControls"],
  [data-testid="editorialFrontpage"] [data-editorial-story]:has([aria-expanded="true"]) [data-testid="articleControls"],
  [data-testid="editorialFrontpage"] [data-testid="insertFrontpageSlot"][data-insertion-near],
  [data-testid="editorialFrontpage"] [data-testid="insertFrontpageSlot"]:hover,
  [data-testid="editorialFrontpage"] [data-testid="insertFrontpageSlot"]:focus {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  [data-testid="editorialFrontpage"] [data-testid="articleControls"],
  [data-testid="editorialFrontpage"] [data-testid="insertFrontpageSlot"] {
    transition: none;
  }
}
`

/** Reveal insertion points by proximity without an invisible hit area covering article links. */
export function EditorVisibility() {
  const styleRef = useRef<HTMLStyleElement>(null)
  useEffect(() => {
    const root = styleRef.current?.closest('[data-testid="editorialFrontpage"]')
    if (!root) return
    let pointer: {x: number; y: number} | undefined
    let frame: number | undefined

    function update() {
      frame = undefined
      const positions = Array.from(
        root!.querySelectorAll<HTMLElement>(
          '[data-testid="insertFrontpageSlot"]',
        ),
        button => ({button, rect: button.getBoundingClientRect()}),
      )
      for (const {button, rect} of positions) {
        const dx = pointer
          ? Math.max(rect.left - pointer.x, 0, pointer.x - rect.right)
          : Infinity
        const dy = pointer
          ? Math.max(rect.top - pointer.y, 0, pointer.y - rect.bottom)
          : Infinity
        const near = rect.width > 0 && Math.hypot(dx, dy) <= 40
        if (near !== button.hasAttribute('data-insertion-near')) {
          button.toggleAttribute('data-insertion-near', near)
        }
      }
    }
    function schedule() {
      frame ??= requestAnimationFrame(update)
    }
    function move(event: PointerEvent) {
      if (event.pointerType !== 'mouse') return
      pointer = {x: event.clientX, y: event.clientY}
      schedule()
    }
    function leave() {
      pointer = undefined
      schedule()
    }
    document.addEventListener('pointermove', move, {passive: true})
    document.addEventListener('pointerleave', leave)
    window.addEventListener('scroll', schedule, {capture: true, passive: true})
    window.addEventListener('blur', leave)
    window.addEventListener('resize', schedule)
    return () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', leave)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('blur', leave)
      window.removeEventListener('resize', schedule)
      if (frame !== undefined) cancelAnimationFrame(frame)
      root
        .querySelectorAll('[data-insertion-near]')
        .forEach(button => button.removeAttribute('data-insertion-near'))
    }
  }, [])
  return <style ref={styleRef}>{styles}</style>
}
