import {
  GRID_SIZE,
  type Point,
  pointOnGrid,
} from '#/features/halloween/costumes/model'

export type CanvasView = {scale: number; x: number; y: number}
export type TouchPoint = Point & {id: number}
export type SurfaceOptions = {
  size: number
  height?: number
  gridSize?: number
  gestures?: boolean
  pan?: boolean
  disabled?: boolean
  onStart: (point: Point | null) => void
  onMove: (point: Point | null) => void
  onEnd: () => void
  onCancel?: () => void
  onUndo?: () => void
  onRedo?: () => void
}

type TouchSession = {
  started: number
  max: number
  moved: boolean
  canceled: boolean
  navigating: boolean
  origins: Map<number, Point>
  pinch?: {ids: number[]; distance: number; center: Point; view: CanvasView}
}

/** One gesture policy for native and browser input; a multi-touch tap never paints. */
export class SurfaceController {
  view: CanvasView = {scale: 1, x: 0, y: 0}
  private touches = new Map<number, Point>()
  private session: TouchSession | null = null
  private stroke: {pan: boolean; start: Point; view: CanvasView} | null = null

  constructor(
    private options: () => SurfaceOptions,
    private changed: (view: CanvasView) => void,
  ) {}

  private setView(view: CanvasView) {
    const {size, height = size} = this.options()
    const scale = Math.max(1, Math.min(12, view.scale))
    this.view = {
      scale,
      x: Math.max(size * (1 - scale), Math.min(0, view.x)),
      y: Math.max(height * (1 - scale), Math.min(0, view.y)),
    }
    this.changed(this.view)
  }

  reset(scale = 1) {
    this.cancelAll()
    const {size, height = size} = this.options()
    this.setView({
      scale,
      x: (size * (1 - scale)) / 2,
      y: (height * (1 - scale)) / 2,
    })
  }

  position(x: number, y: number) {
    const {size, height = size, gridSize = GRID_SIZE} = this.options()
    return x < 0 || y < 0 || x >= size || y >= height
      ? null
      : pointOnGrid(
          (x - this.view.x) / this.view.scale,
          (y - this.view.y) / this.view.scale,
          size,
          gridSize,
          height,
        )
  }

  start(x: number, y: number) {
    const options = this.options()
    if (options.disabled) return
    this.stroke = {pan: !!options.pan, start: {x, y}, view: this.view}
    if (!options.pan) options.onStart(this.position(x, y))
  }

  move(x: number, y: number) {
    if (!this.stroke) return
    if (this.stroke.pan)
      this.setView({
        ...this.view,
        x: this.stroke.view.x + x - this.stroke.start.x,
        y: this.stroke.view.y + y - this.stroke.start.y,
      })
    else this.options().onMove(this.position(x, y))
  }

  end() {
    const stroke = this.stroke
    this.stroke = null
    if (stroke && !stroke.pan) this.options().onEnd()
  }

  cancelStroke() {
    const stroke = this.stroke
    this.stroke = null
    if (stroke && !stroke.pan)
      (this.options().onCancel ?? this.options().onEnd)()
  }

  cancelAll() {
    this.cancelStroke()
    this.touches.clear()
    this.session = null
  }

  hasTouches() {
    return this.touches.size > 0
  }

  touchDown({id, x, y}: TouchPoint, now = Date.now()) {
    const {size, height = size} = this.options()
    if (
      this.options().disabled ||
      this.touches.has(id) ||
      x < 0 ||
      y < 0 ||
      x >= size ||
      y >= height
    )
      return
    if (!this.session)
      this.session = {
        started: now,
        max: 0,
        moved: false,
        canceled: false,
        navigating: false,
        origins: new Map(),
      }
    if (this.session.origins.size > this.touches.size)
      this.session.canceled = true
    this.touches.set(id, {x, y})
    this.session.origins.set(id, {x, y})
    this.session.max = Math.max(this.session.max, this.touches.size)
    if (this.touches.size === 1 && this.session.max === 1) this.start(x, y)
    if (this.touches.size >= 2) {
      this.cancelStroke()
      if (now - this.session.started > 120) this.session.moved = true
      if (this.touches.size === 2 && this.session.max === 2) {
        const entries = [...this.touches]
        const a = entries[0][1]
        const b = entries[1][1]
        this.session.pinch = {
          ids: entries.map(([key]) => key),
          center: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2},
          distance: Math.hypot(a.x - b.x, a.y - b.y),
          view: this.view,
        }
      } else this.session.pinch = undefined
    }
  }

  touchMove({id, x, y}: TouchPoint) {
    const session = this.session
    if (!session || !this.touches.has(id)) return
    this.touches.set(id, {x, y})
    const origin = session.origins.get(id)!
    if (Math.hypot(x - origin.x, y - origin.y) > 8) session.moved = true
    if (session.max === 1) {
      this.move(x, y)
      return
    }
    const pinch = session.pinch
    if (
      !this.options().gestures ||
      !pinch ||
      this.touches.size !== 2 ||
      session.max !== 2
    )
      return
    const a = this.touches.get(pinch.ids[0])
    const b = this.touches.get(pinch.ids[1])
    if (!a || !b || pinch.distance < 1) return
    const distance = Math.hypot(a.x - b.x, a.y - b.y)
    const center = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}
    if (
      Math.abs(distance - pinch.distance) > 6 ||
      Math.hypot(center.x - pinch.center.x, center.y - pinch.center.y) > 8
    )
      session.navigating = true
    if (!session.navigating) return
    session.moved = true
    const scale = Math.max(
      1,
      Math.min(12, (pinch.view.scale * distance) / pinch.distance),
    )
    this.setView({
      scale,
      x:
        center.x - ((pinch.center.x - pinch.view.x) / pinch.view.scale) * scale,
      y:
        center.y - ((pinch.center.y - pinch.view.y) / pinch.view.scale) * scale,
    })
  }

  touchUp(id: number, now = Date.now()) {
    if (!this.touches.delete(id)) return
    if (this.touches.size) return
    const session = this.session
    this.session = null
    if (!session) return
    if (session.max === 1) {
      this.end()
      return
    }
    if (
      this.options().gestures &&
      !session.moved &&
      !session.canceled &&
      now - session.started <= 280
    ) {
      if (session.max === 2) this.options().onUndo?.()
      if (session.max === 3) this.options().onRedo?.()
    }
  }

  touchCancel(id: number) {
    if (!this.touches.has(id)) return
    if (this.session) this.session.canceled = true
    this.cancelStroke()
    this.touchUp(id)
  }

  zoomAt(factor: number, point: Point) {
    if (
      !this.options().gestures ||
      this.options().disabled ||
      this.stroke ||
      this.hasTouches() ||
      !Number.isFinite(factor) ||
      factor <= 0
    )
      return
    const before = this.view
    const scale = Math.max(1, Math.min(12, before.scale * factor))
    this.setView({
      scale,
      x: point.x - ((point.x - before.x) / before.scale) * scale,
      y: point.y - ((point.y - before.y) / before.scale) * scale,
    })
  }

  panBy(x: number, y: number) {
    if (
      !this.options().gestures ||
      this.options().disabled ||
      this.stroke ||
      this.hasTouches()
    )
      return
    this.setView({...this.view, x: this.view.x + x, y: this.view.y + y})
  }

  reveal(point: Point) {
    const {size, height = size, gridSize = GRID_SIZE} = this.options()
    const x =
      (((point.x + 0.5) * size) / gridSize) * this.view.scale + this.view.x
    const y =
      (((point.y + 0.5) * height) / gridSize) * this.view.scale + this.view.y
    this.setView({
      ...this.view,
      x: this.view.x + (x < 0 ? -x : x > size ? size - x : 0),
      y: this.view.y + (y < 0 ? -y : y > height ? height - y : 0),
    })
  }
}
