import {useEffect} from 'react'
import * as SplashScreen from 'expo-splash-screen'

type Props = {
  isReady: boolean
}

/**
 * Keep the native splash visible until the app is ready. The native splash
 * bitmap already includes the Mu logo, so rendering the inherited animated
 * logo transition would display duplicate logos during startup.
 */
export function Splash({isReady, children}: React.PropsWithChildren<Props>) {
  useEffect(() => {
    if (isReady) {
      void SplashScreen.hideAsync()
    }
  }, [isReady])

  return isReady ? children : null
}
