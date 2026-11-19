import {reloadAppAsync} from 'expo'
import {useQueryClient} from '@tanstack/react-query'

import {clearPersistedQueryStorage} from '#/lib/persisted-query-storage'
import {useSession} from '#/state/session'
import {IS_WEB} from '#/env'

/** Restart the app with empty query caches, to move it to another service. */
export function useRestartApp() {
  const queryClient = useQueryClient()
  const {accounts} = useSession()

  return async () => {
    /*
     * Service responses share query keys and carry image URLs, so none may
     * survive the switch.
     */
    queryClient.clear()
    const cacheIds = new Set([
      'logged-out',
      ...accounts.map(account => account.did),
    ])
    await Promise.all([...cacheIds].map(clearPersistedQueryStorage))

    if (IS_WEB) {
      window.location.reload()
    } else {
      await reloadAppAsync()
    }
  }
}
