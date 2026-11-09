import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import {useLingui} from '@lingui/react/macro'
import {createPortal} from 'react-dom'

import {useTheme} from '#/alf'
import {DotGrid2x3_Stroke2_Corner0_Rounded as Grip} from '#/components/icons/DotGrid'
import {Text} from '#/components/Typography'
import {StoryTransitions} from './StoryTransitions'
import {
  type SortableStoriesProps,
  type SortableStoryProps,
  type StoryDragHandleProps,
} from './types'

type DropTarget = {uri: string; edge: 'before' | 'after'}
type Drag = {
  uri: string
  title: string
  pointerId: number
  startX: number
  startY: number
  x: number
  y: number
  started: boolean
  target?: DropTarget
}

const Context = createContext<{
  enabled: boolean
  instructionsId: string
  elements: React.RefObject<Map<string, HTMLDivElement>>
  drag: Drag | null
  start: (
    event: React.PointerEvent<HTMLButtonElement>,
    uri: string,
    title: string,
  ) => void
  move: (event: React.PointerEvent<HTMLButtonElement>) => void
  end: (event: React.PointerEvent<HTMLButtonElement>, cancel?: boolean) => void
  keyboard: (
    event: React.KeyboardEvent<HTMLButtonElement>,
    uri: string,
    title: string,
  ) => void
} | null>(null)

/** Keep the newspaper geometry fixed during pickup; reflow it only when the story is dropped. */
export function SortableStories({
  children,
  enabled,
  order,
  onReorder,
  layoutKey,
}: SortableStoriesProps) {
  const t = useTheme()
  const {t: l} = useLingui()
  const instructionsId = useId()
  const elements = useRef(new Map<string, HTMLDivElement>())
  const dragRef = useRef<Drag | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [announcement, setAnnouncement] = useState('')

  function update(next: Drag | null) {
    dragRef.current = next
    setDrag(next)
  }

  function targetAt(
    x: number,
    y: number,
    source: string,
  ): DropTarget | undefined {
    for (const node of document.elementsFromPoint(x, y)) {
      const story = node.closest<HTMLElement>('[data-editorial-story]')
      const uri = story?.dataset.editorialStory
      if (!uri || uri === source || !elements.current.has(uri)) continue
      const rect = story.getBoundingClientRect()
      const from = elements.current.get(source)?.getBoundingClientRect()
      const sameRow = from && Math.abs(from.top - rect.top) < 24
      const edgeZone = Math.min(80, rect.height / 4)
      const before =
        y < rect.top + edgeZone
          ? true
          : y > rect.bottom - edgeZone
            ? false
            : sameRow
              ? x < rect.left + rect.width / 2
              : y < rect.top + rect.height / 2
      return {uri, edge: before ? 'before' : 'after'}
    }
  }

  function start(
    event: React.PointerEvent<HTMLButtonElement>,
    uri: string,
    title: string,
  ) {
    if (!enabled || event.button !== 0 || dragRef.current) return
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    update({
      uri,
      title,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      started: false,
    })
  }

  function move(event: React.PointerEvent<HTMLButtonElement>) {
    const active = dragRef.current
    if (!active || event.pointerId !== active.pointerId) return
    event.preventDefault()
    const started =
      active.started ||
      Math.hypot(
        event.clientX - active.startX,
        event.clientY - active.startY,
      ) >= 6
    update({
      ...active,
      x: event.clientX,
      y: event.clientY,
      started,
      target: started
        ? targetAt(event.clientX, event.clientY, active.uri)
        : undefined,
    })
  }

  function commit(source: string, target: DropTarget, title: string) {
    onReorder(source, target.uri, target.edge)
    setAnnouncement(l`Moved ${title}.`)
    /* A move into the lead slot remounts the story in a different column. */
    requestAnimationFrame(() =>
      elements.current
        .get(source)
        ?.querySelector<HTMLButtonElement>('[data-story-handle]')
        ?.focus({preventScroll: true}),
    )
  }

  function end(event: React.PointerEvent<HTMLButtonElement>, cancel = false) {
    const active = dragRef.current
    if (!active || event.pointerId !== active.pointerId) return
    update(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
    if (!cancel && active.started && active.target && enabled)
      commit(active.uri, active.target, active.title)
  }

  function keyboard(
    event: React.KeyboardEvent<HTMLButtonElement>,
    uri: string,
    title: string,
  ) {
    if (!enabled || dragRef.current) return
    const index = order.indexOf(uri)
    let target: DropTarget | undefined
    if (['ArrowUp', 'ArrowLeft'].includes(event.key) && index > 0)
      target = {uri: order[index - 1], edge: 'before'}
    else if (
      ['ArrowDown', 'ArrowRight'].includes(event.key) &&
      index >= 0 &&
      index < order.length - 1
    )
      target = {uri: order[index + 1], edge: 'after'}
    else if (event.key === 'Home' && index > 0)
      target = {uri: order[0], edge: 'before'}
    else if (event.key === 'End' && index >= 0 && index < order.length - 1)
      target = {uri: order[order.length - 1], edge: 'after'}
    if (
      [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Home',
        'End',
      ].includes(event.key)
    )
      event.preventDefault()
    if (target) commit(uri, target, title)
  }

  useEffect(() => {
    if (!enabled) update(null)
  }, [enabled])

  useEffect(() => {
    if (!drag) return
    const cancel = () => update(null)
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancel()
      }
    }
    window.addEventListener('keydown', keydown)
    window.addEventListener('blur', cancel)
    return () => {
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('blur', cancel)
    }
  }, [!!drag])

  /* Keep dragging through the front page without introducing a nested scroll area. */
  useEffect(() => {
    if (!drag?.started) return
    let frame: number
    const tick = () => {
      const active = dragRef.current
      if (!active?.started) return
      const scroller = document.scrollingElement
      if (scroller) {
        const delta =
          active.y < 64
            ? -Math.min(18, (64 - active.y) / 3)
            : active.y > window.innerHeight - 64
              ? Math.min(18, (active.y - window.innerHeight + 64) / 3)
              : 0
        if (delta) {
          scroller.scrollTop += delta
          const target = targetAt(active.x, active.y, active.uri)
          if (
            target?.uri !== active.target?.uri ||
            target?.edge !== active.target?.edge
          )
            update({...active, target})
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [!!drag?.started])

  return (
    <Context.Provider
      value={{
        enabled,
        instructionsId,
        elements,
        drag,
        start,
        move,
        end,
        keyboard,
      }}>
      <StoryTransitions
        enabled={enabled}
        layoutKey={layoutKey ?? order.join('\n')}>
        {children}
      </StoryTransitions>
      {enabled && (
        <>
          <span
            id={instructionsId}
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clipPath: 'inset(50%)',
            }}>
            <Text>{l`Drag to reorder. You can also use the arrow keys, Home, or End while this handle is focused. Press Escape to cancel a drag.`}</Text>
          </span>
          <span
            role="status"
            aria-live="polite"
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              overflow: 'hidden',
              clipPath: 'inset(50%)',
            }}>
            <Text>{announcement}</Text>
          </span>
        </>
      )}
      {drag?.started &&
        createPortal(
          <div
            aria-hidden="true"
            data-testid="storyDragPreview"
            style={{
              position: 'fixed',
              left: Math.min(drag.x + 16, window.innerWidth - 268),
              top: Math.min(drag.y + 16, window.innerHeight - 120),
              zIndex: 10000,
              pointerEvents: 'none',
              width: 240,
              padding: 12,
              border: `2px solid ${t.palette.primary_500}`,
              borderRadius: 4,
              background: t.atoms.bg.backgroundColor,
              color: t.atoms.text.color,
              boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
              fontFamily: 'inherit',
              fontSize: 16,
              lineHeight: 1.35,
              fontWeight: 600,
            }}>
            <Text
              emoji
              style={{fontSize: 16, lineHeight: 22, fontWeight: '600'}}>
              {drag.title}
            </Text>
          </div>,
          document.body,
        )}
    </Context.Provider>
  )
}

export function SortableStory({uri, children}: SortableStoryProps) {
  const context = useContext(Context)
  const t = useTheme()
  const {t: l} = useLingui()
  if (!context?.enabled) return children
  const active = context.drag?.started && context.drag.uri === uri
  const target =
    context.drag?.started && context.drag.target?.uri === uri
      ? context.drag.target
      : undefined
  return (
    <div
      data-editorial-story={uri}
      data-drop-edge={target?.edge}
      ref={node => {
        if (node) context.elements.current.set(uri, node)
        else context.elements.current.delete(uri)
      }}
      style={{
        position: 'relative',
        minWidth: 0,
        width: '100%',
        opacity: active ? 0.4 : 1,
      }}>
      {children}
      {target && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            ...(target.edge === 'before' ? {top: -10} : {bottom: -10}),
            borderTop: `3px solid ${t.palette.primary_500}`,
            pointerEvents: 'none',
            zIndex: 1,
          }}>
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: -10,
              padding: '2px 6px',
              borderRadius: 3,
              color: t.palette.white,
              background: t.palette.primary_500,
              fontSize: 12,
              lineHeight: '16px',
            }}>
            <Text
              style={{
                fontSize: 12,
                lineHeight: 16,
                color: t.palette.white,
              }}>{l`Drop here`}</Text>
          </span>
        </div>
      )}
    </div>
  )
}

export function StoryDragHandle({uri, title}: StoryDragHandleProps) {
  const context = useContext(Context)
  const t = useTheme()
  const {t: l} = useLingui()
  if (!context?.enabled) return null
  return (
    <button
      type="button"
      data-testid="storyDragHandle"
      data-story-handle
      aria-label={l`Drag to reorder ${title}`}
      aria-describedby={context.instructionsId}
      onPointerDown={event => context.start(event, uri, title)}
      onPointerMove={context.move}
      onPointerUp={event => context.end(event)}
      onPointerCancel={event => context.end(event, true)}
      onLostPointerCapture={event => context.end(event, true)}
      onKeyDown={event => context.keyboard(event, uri, title)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        padding: 6,
        border: `1px solid ${t.atoms.border_contrast_low.borderColor}`,
        borderRadius: 999,
        background: t.atoms.bg.backgroundColor,
        color: t.atoms.text_contrast_medium.color,
        cursor: context.drag?.uri === uri ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
        flexShrink: 0,
      }}>
      <Grip size="lg" fill={t.atoms.text_contrast_medium.color} />
    </button>
  )
}
