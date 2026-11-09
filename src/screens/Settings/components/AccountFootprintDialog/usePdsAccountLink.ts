import {useSession} from '#/state/session'
import {pdsAccountLink} from './pdsAccountLink'

/**
 * Where an OAuth user deletes their account: the hosting provider's account
 * page. OAuth sessions can't authorize deleteAccount themselves.
 */
export function usePdsAccountLink() {
  const {currentAccount} = useSession()
  return pdsAccountLink({
    pdsUrl: currentAccount?.pdsUrl,
    service: currentAccount?.service,
  })
}
