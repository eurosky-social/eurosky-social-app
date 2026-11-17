import {useEffect, useState} from 'react'
import {AppState} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useAppviewClient, useSession} from '#/state/session'
import * as Prompt from '#/components/Prompt'
import {
  type AppViewFailoverCandidate,
  endAppViewFailoverIfRecovered,
  findAppViewFailover,
  saveAppViewFailover,
} from './failover'
import {resetAppViewHealth, useAppViewDown} from './health'
import {useRestartApp} from './useRestartApp'

/** Once per process, so declining is not answered with the same question. */
let offered = false

/**
 * Offers another content service when the active one stops responding, and
 * quietly ends that failover once the preferred service is back.
 */
export function AppViewFailoverPrompt() {
  const {t: l} = useLingui()
  const control = Prompt.usePromptControl()
  const {currentAccount} = useSession()
  const client = useAppviewClient()
  const isDown = useAppViewDown()
  const restart = useRestartApp()
  const [candidate, setCandidate] = useState<AppViewFailoverCandidate>()
  const did = currentAccount?.did

  useEffect(() => {
    const session = did ? {client, did} : undefined
    const check = () => void endAppViewFailoverIfRecovered(session)
    check()
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') check()
    })
    return () => subscription.remove()
  }, [client, did])

  useEffect(() => {
    if (!isDown || offered) return
    let ignore = false
    void findAppViewFailover(did ? {client, did} : undefined).then(found => {
      if (ignore) return
      if (found) {
        offered = true
        setCandidate(found)
        control.open()
      } else {
        /* Not an outage we can route around; let the breaker trip again. */
        resetAppViewHealth()
      }
    })
    return () => {
      ignore = true
    }
  }, [isDown, client, did, control])

  const names = {
    bluesky: l`Bluesky`,
    eurosky: l`Eurosky`,
    blacksky: l`Blacksky`,
  }
  const name = candidate ? names[candidate.id] : ''

  return (
    <Prompt.Basic
      control={control}
      title={l`Content service isn’t responding`}
      description={l`Switch to ${name} until it’s back? The app will restart.`}
      confirmButtonCta={l`Switch`}
      cancelButtonCta={l`Not now`}
      onConfirm={() => {
        if (!candidate) return
        saveAppViewFailover(candidate)
        void restart()
      }}
    />
  )
}
