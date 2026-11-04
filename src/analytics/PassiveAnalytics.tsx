import {useEffect} from 'react'

import {onAppStateChange} from '#/lib/appState'
import {useAnalytics} from '#/analytics'

/**
 * Tracks app foreground/background transitions without measuring duration.
 */
export function PassiveAnalytics() {
  const ax = useAnalytics()

  useEffect(() => {
    const sub = onAppStateChange(state => {
      if (state === 'active') {
        ax.metric('state:foreground', {})
      } else {
        ax.metric('state:background', {})
      }
    })
    return () => sub.remove()
  }, [ax])

  return null
}
