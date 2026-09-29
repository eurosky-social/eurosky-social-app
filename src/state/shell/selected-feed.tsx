import {createContext, useCallback, useContext, useState} from 'react'

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

/** Per-tab memory, scoped by DID to prevent feed selection leaking across accounts. */
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
      try {
        const feedFromSession = sessionStorage.getItem(homeFeedSessionKey(did))
        if (feedFromSession) {
          // Fall back to a previously chosen feed for this browser tab.
          return feedFromSession as FeedDescriptor
        }
      } catch {
        // Storage may be blocked by the browser; fall back to account storage.
      }
    }

    const feedFromStorage = account.get([did, 'lastSelectedHomeFeed'])
    if (feedFromStorage) {
      // Fall back to the last chosen one across all tabs.
      return feedFromStorage as FeedDescriptor
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
