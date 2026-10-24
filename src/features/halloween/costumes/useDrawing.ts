import {useRef, useState} from 'react'

import {normalizeHex} from '#/features/halloween/costumes/colors'
import {
  type Costume,
  EMPTY_PIXELS,
  floodFill,
  GRID_SIZE,
  paintLine,
  type Point,
  sameCostume,
  TRANSPARENT,
  withColor,
} from '#/features/halloween/costumes/model'

export type DrawingTool =
  'brush' | 'line' | 'eraser' | 'fill' | 'pan' | 'eyedropper'
const HISTORY_LIMIT = 50

type History = {past: Costume[]; future: Costume[]}

/** Stroke transactions allow multi-finger navigation to roll back accidental marks. */
export function useDrawing(
  initial: Costume,
  onColorLimit: () => void,
  options: {
    samplePhoto?: (point: Point) => string | null
    onSampleMiss?: () => void
    onColorUsed?: (color: string) => void
  } = {},
) {
  const [costume, setCostume] = useState(initial)
  const draft = useRef(initial)
  const [tool, setToolState] = useState<DrawingTool>('brush')
  const previousTool = useRef<DrawingTool>('brush')
  const [color, setColor] = useState('#FF8A24')
  const [brushSize, setBrushSize] = useState(2)
  const [history, setHistory] = useState<History>({past: [], future: []})
  const historyRef = useRef(history)
  const stroke = useRef<{
    before: Costume
    base: Costume
    start: Point
    last: Point | null
    ink: number
    size: number
    tool: DrawingTool
    colorBefore: string
    sampled?: string
  } | null>(null)
  const update = (next: Costume) => {
    draft.current = next
    setCostume(next)
  }
  const updateHistory = (next: History) => {
    historyRef.current = next
    setHistory(next)
  }
  const remember = (before: Costume, after: Costume) => {
    if (sameCostume(before, after)) return false
    updateHistory({
      past: [...historyRef.current.past.slice(1 - HISTORY_LIMIT), before],
      future: [],
    })
    return true
  }
  const cancel = () => {
    const active = stroke.current
    stroke.current = null
    if (!active) return
    if (draft.current !== active.before) update(active.before)
    if (active.tool === 'eyedropper') setColor(active.colorBefore)
  }
  const end = () => {
    const active = stroke.current
    stroke.current = null
    if (!active) return draft.current
    if (active.tool === 'eyedropper') {
      if (active.sampled) setToolState(previousTool.current)
      else options.onSampleMiss?.()
      return draft.current
    }
    /* Fill commits on release, so starting a pinch cannot flash a filled avatar. */
    if (active.tool === 'fill')
      update({
        ...active.base,
        pixels: floodFill(active.base.pixels, active.start, active.ink),
      })
    if (remember(active.before, draft.current) && active.tool !== 'eraser')
      options.onColorUsed?.(active.base.palette[active.ink])
    return draft.current
  }
  const sample = (point: Point) => {
    if (
      (point.x + 0.5 - GRID_SIZE / 2) ** 2 +
        (point.y + 0.5 - GRID_SIZE / 2) ** 2 >
      (GRID_SIZE / 2) ** 2
    )
      return null
    const index = draft.current.pixels[point.y * GRID_SIZE + point.x]
    const picked =
      index >= 0 ? draft.current.palette[index] : options.samplePhoto?.(point)
    return picked ? normalizeHex(picked) : null
  }
  const move = (point: Point | null) => {
    const active = stroke.current
    if (!active || active.tool === 'fill') return
    if (point && active.tool === 'eyedropper') {
      const picked = sample(point)
      if (picked) {
        active.sampled = picked
        setColor(picked)
      }
    } else if (point) {
      const base =
        active.tool === 'line'
          ? active.base
          : {...draft.current, palette: active.base.palette}
      const pixels = paintLine(
        base.pixels,
        active.tool === 'line' ? active.start : (active.last ?? point),
        point,
        active.ink,
        active.size,
      )
      if (pixels !== draft.current.pixels) update({...base, pixels})
    }
    active.last = point
  }
  const start = (point: Point | null) => {
    end()
    if (!point || tool === 'pan') return
    const before = draft.current
    const ink =
      tool === 'eraser' || tool === 'eyedropper'
        ? {costume: before, ink: TRANSPARENT}
        : withColor(before, color)
    if (!ink) {
      onColorLimit()
      return
    }
    stroke.current = {
      before,
      base: ink.costume,
      start: point,
      last: null,
      ink: ink.ink,
      size: brushSize,
      tool,
      colorBefore: color,
    }
    if (tool !== 'fill') move(point)
  }
  const setTool = (next: DrawingTool) => {
    end()
    if (next === 'eyedropper' && tool !== 'eyedropper')
      previousTool.current =
        tool === 'eraser' || tool === 'pan' ? 'brush' : tool
    setToolState(next)
  }
  const undo = () => {
    if (stroke.current) return
    const {past, future} = historyRef.current
    const previous = past.at(-1)
    if (!previous) return
    updateHistory({past: past.slice(0, -1), future: [draft.current, ...future]})
    update(previous)
  }
  const redo = () => {
    if (stroke.current) return
    const {past, future} = historyRef.current
    const next = future[0]
    if (!next) return
    updateHistory({past: [...past, draft.current], future: future.slice(1)})
    update(next)
  }
  const clear = () => {
    end()
    const before = draft.current
    const next = {...before, pixels: [...EMPTY_PIXELS]}
    remember(before, next)
    update(next)
  }
  const selectColor = (next: string) => {
    const normalized = normalizeHex(next)
    if (!normalized) return
    setColor(normalized)
    if (tool === 'eraser' || tool === 'pan' || tool === 'eyedropper')
      setToolState('brush')
  }
  return {
    costume,
    tool,
    setTool,
    color,
    selectColor,
    brushSize,
    setBrushSize,
    start,
    move,
    end,
    cancel,
    undo,
    redo,
    clear,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    dirty: !sameCostume(initial, costume),
  }
}
