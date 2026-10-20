import {useRef} from 'react'
import {
  type GestureResponderEvent,
  type NativeTouchEvent,
  View,
} from 'react-native'

import {type DrawingSurfaceProps} from '#/features/halloween/costumes/DrawingSurface/types'
import {useSurface} from '#/features/halloween/costumes/DrawingSurface/useSurface'

export function DrawingSurface(props: DrawingSurfaceProps) {
  const {children, size, height = size, disabled = false, label, hint} = props
  const input = useSurface(props)
  const origin = useRef({x: 0, y: 0})
  const point = (touch: NativeTouchEvent) => ({
    id: touch.identifier,
    x: Number.isFinite(touch.pageX)
      ? touch.pageX - origin.current.x
      : touch.locationX,
    y: Number.isFinite(touch.pageY)
      ? touch.pageY - origin.current.y
      : touch.locationY,
  })
  const sync = (
    event: GestureResponderEvent,
    phase: 'start' | 'move' | 'end',
  ) => {
    const {touches, changedTouches, locationX, locationY} = event.nativeEvent
    /* Synthetic/accessibility events may not carry the native touch list. */
    if (!touches) {
      if (phase === 'start') input.start(locationX, locationY)
      else {
        input.move(locationX, locationY)
        if (phase === 'end') input.end()
      }
      return
    }
    if (phase === 'start')
      for (const touch of touches) input.touchDown(point(touch))
    else {
      for (const touch of touches) input.touchMove(point(touch))
      if (phase === 'end')
        for (const touch of changedTouches ?? []) {
          input.touchMove(point(touch))
          input.touchUp(touch.identifier)
        }
    }
  }
  return (
    <View
      testID="costumeDrawingSurface"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onStartShouldSetResponder={() => !disabled}
      onMoveShouldSetResponder={() => !disabled}
      onResponderTerminationRequest={() => false}
      onResponderGrant={event => {
        const {pageX, pageY, locationX, locationY} = event.nativeEvent
        origin.current = {
          x: Number.isFinite(pageX) ? pageX - locationX : 0,
          y: Number.isFinite(pageY) ? pageY - locationY : 0,
        }
        sync(event, 'start')
      }}
      onResponderStart={event => sync(event, 'start')}
      onResponderMove={event => sync(event, 'move')}
      onResponderEnd={event => sync(event, 'end')}
      onResponderRelease={event => sync(event, 'end')}
      onResponderTerminate={input.cancel}
      style={{width: size, height, overflow: 'hidden'}}>
      <View
        testID="costumeCanvasTransform"
        pointerEvents="none"
        style={{
          width: size,
          height,
          transformOrigin: 'top left',
          transform: [
            {translateX: input.view.x},
            {translateY: input.view.y},
            {scale: input.view.scale},
          ],
        }}>
        {children}
      </View>
    </View>
  )
}
