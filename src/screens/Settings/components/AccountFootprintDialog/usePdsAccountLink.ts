import {toNiceHostingUrl} from '#/lib/strings/url-helpers'
import {useSession} from '#/state/session'

/**
 * Where an OAuth user deletes their account: the hosting provider's account
 * page. OAuth sessions can't authorize deleteAccount themselves.
 */
export function usePdsAccountLink() {
  const {currentAccount} = useSession()
  const pdsUrl = currentAccount?.pdsUrl ?? currentAccount?.service ?? ''
  return {
    host: toNiceHostingUrl(pdsUrl),
    url: pdsUrl ? new URL('/account', pdsUrl).href : '',
  }
}
