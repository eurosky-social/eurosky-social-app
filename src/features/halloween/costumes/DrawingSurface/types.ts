import {type Point} from '#/features/halloween/costumes/model'

export type DrawingSurfaceProps = React.PropsWithChildren<{
  size: number
  height?: number
  gridSize?: number
  zoom?: number
  resetKey?: number
  /** Canvas navigation and multi-finger history gestures; off in color controls. */
  gestures?: boolean
  pan?: boolean
  disabled?: boolean
  cursorSize?: number
  label: string
  hint: string
  onStart: (point: Point | null) => void
  onMove: (point: Point | null) => void
  onEnd: () => void
  onCancel?: () => void
  onUndo?: () => void
  onRedo?: () => void
}>
