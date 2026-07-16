import {createContext, useCallback, useContext, useState} from 'react'

import {FU_FEED_URI} from '#/lib/constants'
import {type FeedDescriptor} from '#/state/queries/post-feed'
import {useSession} from '#/state/session'
import {IS_WEB} from '#/env'
import {account} from '#/storage'

type StateContext = FeedDescriptor | null
type SetContext = (v: FeedDescriptor) => void

const stateContext = createContext<StateContext>(null)
stateContext.displayName = 'SelectedFeedStateContext'
const setContext = createContext<SetContext>((_: string) => {})
setContext.displayName = 'SelectedFeedSetContext'

// Per-tab, per-account memory of the last selected home feed. Scoped by DID so
// switching accounts in the same browser tab does not carry one account's feed
// over to another (which would, among other things, stop a newly created account
// from landing on its default feed).
function homeFeedSessionKey(did: string) {
  return `lastSelectedHomeFeed:${did}`
}

function getInitialFeed(did?: string): FeedDescriptor | null {
  // An explicit deep link (/?feed=...) always wins.
  if (IS_WEB && window.location.pathname === '/') {
    const params = new URLSearchParams(window.location.search)
    const feedFromUrl = params.get('feed')
    if (feedFromUrl) {
      return feedFromUrl as FeedDescriptor
    }
  }

  if (did) {
    if (IS_WEB) {
      const feedFromSession = sessionStorage.getItem(homeFeedSessionKey(did))
      if (feedFromSession) {
        // Fall back to a previously chosen feed for this browser tab.
        return feedFromSession as FeedDescriptor
      }
    }

    const feedFromStorage = account.get([did, 'lastSelectedHomeFeed'])
    if (feedFromStorage) {
      // Fall back to the last chosen one across all tabs.
      return feedFromStorage as FeedDescriptor
    }

    // No previously selected home feed means this is the first time the account
    // has opened the app on this device (an existing Bluesky account logging into
    // mu counts as new here too). Adopt the Eurosky "fu" feed as a local-only
    // default so these users land on it. Recorded per-account and never written
    // to the account's server-side saved feeds, so it does not sync to other
    // clients. usePinnedFeedsInfos turns this into a pinned tab.
    let localDefaultFeed = account.get([did, 'localDefaultFeed'])
    if (localDefaultFeed === undefined) {
      localDefaultFeed = FU_FEED_URI
      account.set([did, 'localDefaultFeed'], localDefaultFeed)
    }
    if (localDefaultFeed) {
      return `feedgen|${localDefaultFeed}`
    }
  }

  return null
}

export function Provider({children}: React.PropsWithChildren<{}>) {
  const {currentAccount} = useSession()
  const did = currentAccount?.did
  const [state, setState] = useState(() => getInitialFeed(did))

  const saveState = useCallback(
    (feed: FeedDescriptor) => {
      setState(feed)
      if (did) {
        if (IS_WEB) {
          try {
            sessionStorage.setItem(homeFeedSessionKey(did), feed)
          } catch {}
        }
        account.set([did, 'lastSelectedHomeFeed'], feed)
      }
    },
    [did],
  )

  return (
    <stateContext.Provider value={state}>
      <setContext.Provider value={saveState}>{children}</setContext.Provider>
    </stateContext.Provider>
  )
}

export function useSelectedFeed() {
  return useContext(stateContext)
}

export function useSetSelectedFeed() {
  return useContext(setContext)
}
