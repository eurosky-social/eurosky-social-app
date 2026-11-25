import {useCallback, useSyncExternalStore} from 'react'

import {getPlaybackSecond, subscribePlaybackPositions} from './playback'

/**
 * The whole second the video of `postUri` is at, as its player reports it,
 * or `undefined` before any player has. Updates once a second while playing.
 */
export function usePlaybackSecond(postUri: string): number | undefined {
  const get = useCallback(() => getPlaybackSecond(postUri), [postUri])
  return useSyncExternalStore(subscribePlaybackPositions, get)
}
