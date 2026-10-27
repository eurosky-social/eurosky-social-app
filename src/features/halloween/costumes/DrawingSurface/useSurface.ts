import {useLayoutEffect, useRef, useState} from 'react'

import {SurfaceController} from '#/features/halloween/costumes/DrawingSurface/controller'
import {type DrawingSurfaceProps} from '#/features/halloween/costumes/DrawingSurface/types'

/** React only owns the visual transform; gesture transactions are synchronous. */
export function useSurface(props: DrawingSurfaceProps) {
  const {size, height = size, zoom = 1, resetKey = 0, disabled} = props
  const latest = useRef(props)
  const [view, setView] = useState({
    scale: zoom,
    x: (size * (1 - zoom)) / 2,
    y: (height * (1 - zoom)) / 2,
  })
  const [controller] = useState(
    () => new SurfaceController(() => latest.current, setView),
  )
  useLayoutEffect(() => {
    latest.current = props
  })
  useLayoutEffect(() => {
    controller.reset(zoom)
  }, [controller, size, height, zoom, resetKey])
  useLayoutEffect(() => {
    if (disabled) controller.cancelAll()
  }, [controller, disabled])
  useLayoutEffect(() => () => controller.cancelAll(), [controller])
  return {
    view,
    offset: {x: view.x, y: view.y},
    position: (x: number, y: number) => controller.position(x, y),
    start: (x: number, y: number) => controller.start(x, y),
    move: (x: number, y: number) => controller.move(x, y),
    end: () => controller.end(),
    cancel: () => controller.cancelAll(),
    touchDown: controller.touchDown.bind(controller),
    touchMove: controller.touchMove.bind(controller),
    touchUp: controller.touchUp.bind(controller),
    touchCancel: controller.touchCancel.bind(controller),
    hasTouches: () => controller.hasTouches(),
    zoomAt: controller.zoomAt.bind(controller),
    panBy: controller.panBy.bind(controller),
    reset: () => controller.reset(),
    reveal: controller.reveal.bind(controller),
  }
}
