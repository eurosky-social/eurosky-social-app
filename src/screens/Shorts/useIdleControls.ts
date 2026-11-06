import {useEffect, useRef, useState} from 'react'

export const SHORTS_CONTROLS_IDLE_MS = 2000

/** Keep playback running while idle; never hide a menu or a keyboard-focused control. */
export function useIdleControls(enabled: boolean, clip: number) {
  const [visible, setVisible] = useState(true)
  const wake = useRef<() => void>(() => {})
  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout>
    let keyboard = false
    function hide() {
      if (
        document.querySelector('[role="menu"], [role="dialog"]') ||
        (keyboard &&
          document.activeElement?.matches(
            'button,a,input,[role="button"],[role="link"],[role="slider"]',
          ))
      ) {
        timer = setTimeout(hide, SHORTS_CONTROLS_IDLE_MS)
        return
      }
      setVisible(false)
    }
    function reveal() {
      setVisible(true)
      clearTimeout(timer)
      timer = setTimeout(hide, SHORTS_CONTROLS_IDLE_MS)
    }
    function pointer() {
      keyboard = false
      reveal()
    }
    function key() {
      keyboard = true
      reveal()
    }
    wake.current = reveal
    reveal()
    document.addEventListener('pointermove', pointer, {passive: true})
    document.addEventListener('pointerdown', pointer, {passive: true})
    document.addEventListener('keydown', key)
    document.addEventListener('focusin', reveal)
    document.addEventListener('scroll', reveal, {capture: true, passive: true})
    return () => {
      clearTimeout(timer)
      wake.current = () => {}
      document.removeEventListener('pointermove', pointer)
      document.removeEventListener('pointerdown', pointer)
      document.removeEventListener('keydown', key)
      document.removeEventListener('focusin', reveal)
      document.removeEventListener('scroll', reveal, true)
    }
  }, [enabled, clip])
  return {visible: !enabled || visible, reveal: () => wake.current()}
}
