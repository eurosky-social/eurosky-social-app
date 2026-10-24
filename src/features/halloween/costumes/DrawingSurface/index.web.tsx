import {useEffect, useEffectEvent, useRef, useState} from 'react'

import {type DrawingSurfaceProps} from '#/features/halloween/costumes/DrawingSurface/types'
import {useSurface} from '#/features/halloween/costumes/DrawingSurface/useSurface'
import {GRID_SIZE, type Point} from '#/features/halloween/costumes/model'

type SafariGesture = Event & {scale: number; clientX: number; clientY: number}

/** Touch, pen, mouse, trackpad wheel-pinch, and WebKit gesture events share one view. */
export function DrawingSurface(props: DrawingSurfaceProps) {
  const {
    children,
    size,
    height = size,
    gridSize = GRID_SIZE,
    gestures = false,
    pan = false,
    disabled = false,
    cursorSize = 1,
    label,
    hint,
    onStart,
    onEnd,
    onUndo,
    onRedo,
  } = props
  const input = useSurface(props)
  const root = useRef<HTMLDivElement>(null)
  const pointer = useRef<number | null>(null)
  const safariScale = useRef<number | null>(null)
  const [cursor, setCursor] = useState({
    x: Math.floor(gridSize / 2),
    y: Math.floor(gridSize / 2),
  })
  const [focused, setFocused] = useState(false)
  const [hover, setHover] = useState<Point | null>(null)
  const position = (sample: {clientX: number; clientY: number}) => {
    const rect = root.current!.getBoundingClientRect()
    return {
      x: ((sample.clientX - rect.left) / rect.width) * size,
      y: ((sample.clientY - rect.top) / rect.height) * height,
    }
  }
  const wheel = useEffectEvent((event: WheelEvent) => {
    if (!gestures || disabled) return
    event.preventDefault()
    if (safariScale.current !== null) return
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1
    if (event.ctrlKey || event.metaKey)
      input.zoomAt(
        Math.exp(-Math.max(-100, Math.min(100, event.deltaY * unit)) * 0.01),
        position(event),
      )
    else input.panBy(-event.deltaX * unit, -event.deltaY * unit)
  })
  const safariStart = useEffectEvent((event: Event) => {
    if (!gestures || disabled) return
    event.preventDefault()
    safariScale.current = (event as SafariGesture).scale || 1
  })
  const safariChange = useEffectEvent((event: Event) => {
    if (!gestures || disabled || safariScale.current === null) return
    event.preventDefault()
    const sample = event as SafariGesture
    if (!Number.isFinite(sample.scale) || sample.scale <= 0) return
    const focal =
      sample.clientX || sample.clientY
        ? position(sample)
        : {x: size / 2, y: height / 2}
    input.zoomAt(sample.scale / safariScale.current, focal)
    safariScale.current = sample.scale
  })
  useEffect(() => {
    const element = root.current!
    const onWheel = (event: WheelEvent) => wheel(event)
    const onStart = (event: Event) => safariStart(event)
    const onChange = (event: Event) => safariChange(event)
    const onEnd = (event: Event) => {
      if (safariScale.current !== null) event.preventDefault()
      safariScale.current = null
    }
    element.addEventListener('wheel', onWheel, {passive: false})
    element.addEventListener('gesturestart', onStart, {passive: false})
    element.addEventListener('gesturechange', onChange, {passive: false})
    element.addEventListener('gestureend', onEnd)
    return () => {
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('gesturestart', onStart)
      element.removeEventListener('gesturechange', onChange)
      element.removeEventListener('gestureend', onEnd)
    }
  }, [])

  const cancel = () => {
    pointer.current = null
    input.cancel()
    safariScale.current = null
  }
  const cancelPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') input.touchCancel(event.pointerId)
    else if (pointer.current === event.pointerId) cancel()
  }
  const visibleCursor = focused ? cursor : hover
  const scale = input.view.scale

  return (
    <div
      ref={root}
      data-testid="costumeDrawingSurface"
      role="group"
      tabIndex={disabled ? -1 : 0}
      aria-label={`${label}. ${hint}`}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        cancel()
      }}
      onPointerDown={event => {
        if (disabled || event.button !== 0) return
        if (event.pointerType === 'touch') {
          if (pointer.current !== null) return
          event.preventDefault()
          event.stopPropagation()
          event.currentTarget.focus()
          setFocused(false)
          setHover(null)
          event.currentTarget.setPointerCapture(event.pointerId)
          input.touchDown({id: event.pointerId, ...position(event)})
          return
        }
        if (!event.isPrimary || pointer.current !== null || input.hasTouches())
          return
        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.focus()
        setFocused(false)
        event.currentTarget.setPointerCapture(event.pointerId)
        pointer.current = event.pointerId
        const point = position(event)
        const pixel = input.position(point.x, point.y)
        if (pixel) setCursor(pixel)
        input.start(point.x, point.y)
      }}
      onPointerMove={event => {
        const point = position(event)
        if (event.pointerType === 'touch') {
          input.touchMove({id: event.pointerId, ...point})
          return
        }
        setHover(input.position(point.x, point.y))
        if (pointer.current !== event.pointerId) return
        for (const sample of event.nativeEvent.getCoalescedEvents?.() ?? []) {
          const next = position(sample)
          input.move(next.x, next.y)
        }
        input.move(point.x, point.y)
      }}
      onPointerUp={event => {
        const point = position(event)
        if (event.pointerType === 'touch') {
          input.touchMove({id: event.pointerId, ...point})
          input.touchUp(event.pointerId)
        } else {
          if (pointer.current !== event.pointerId) return
          input.move(point.x, point.y)
          pointer.current = null
          input.end()
        }
        event.currentTarget.releasePointerCapture(event.pointerId)
      }}
      onPointerLeave={() => setHover(null)}
      onPointerCancel={cancelPointer}
      onLostPointerCapture={cancelPointer}
      onKeyDown={event => {
        if (disabled || pointer.current !== null || input.hasTouches()) return
        if (
          (event.metaKey || event.ctrlKey) &&
          event.key.toLowerCase() === 'z'
        ) {
          const action = event.shiftKey ? onRedo : onUndo
          if (action) {
            event.preventDefault()
            action()
          }
          return
        }
        if (gestures && ['+', '=', '-', '0'].includes(event.key)) {
          event.preventDefault()
          if (event.key === '0') input.reset()
          else
            input.zoomAt(event.key === '-' ? 0.8 : 1.25, {
              x: size / 2,
              y: height / 2,
            })
          return
        }
        if (pan) return
        if (event.key.startsWith('Arrow')) {
          event.preventDefault()
          setFocused(true)
          const next = {
            x: Math.max(
              0,
              Math.min(
                gridSize - 1,
                cursor.x +
                  (event.key === 'ArrowRight'
                    ? 1
                    : event.key === 'ArrowLeft'
                      ? -1
                      : 0),
              ),
            ),
            y: Math.max(
              0,
              Math.min(
                gridSize - 1,
                cursor.y +
                  (event.key === 'ArrowDown'
                    ? 1
                    : event.key === 'ArrowUp'
                      ? -1
                      : 0),
              ),
            ),
          }
          setCursor(next)
          input.reveal(next)
        } else if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          setFocused(true)
          onStart(cursor)
          onEnd()
        }
      }}
      style={{
        width: size,
        height,
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'none',
        overscrollBehavior: 'contain',
        userSelect: 'none',
        cursor: pan ? 'grab' : 'crosshair',
        outline: focused ? undefined : 'none',
      }}>
      <div
        data-testid="costumeCanvasTransform"
        style={{
          pointerEvents: 'none',
          width: size,
          height,
          transformOrigin: 'top left',
          transform: `translate(${input.view.x}px, ${input.view.y}px) scale(${scale})`,
        }}>
        {children}
      </div>
      {!pan && !disabled && visibleCursor && (
        <div
          style={{
            position: 'absolute',
            pointerEvents: 'none',
            left:
              (((visibleCursor.x - Math.floor(cursorSize / 2)) * size) /
                gridSize) *
                scale +
              input.view.x,
            top:
              (((visibleCursor.y - Math.floor(cursorSize / 2)) * height) /
                gridSize) *
                scale +
              input.view.y,
            width: ((cursorSize * size) / gridSize) * scale,
            height: ((cursorSize * height) / gridSize) * scale,
            borderRadius: cursorSize > 1 ? '50%' : 0,
            outline: '1px solid white',
            boxShadow: '0 0 0 2px black',
          }}
        />
      )}
    </div>
  )
}
