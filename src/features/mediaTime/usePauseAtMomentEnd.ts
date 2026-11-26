import {useEffect} from 'react'

import {type Moment} from './moments'
import {
  getPlaybackSecond,
  pauseIfVisible,
  subscribePlaybackPositions,
} from './playback'

/**
 * A move of at most this many seconds between two reported seconds is the
 * video playing; a longer one is a jump.
 */
export const MAX_PLAYING_STEP_SECONDS = 2

/**
 * Pauses the video of `postUri` when it plays to the end of `moment` (the
 * second of its latest comment), so people can read the moment's comments
 * without the video running on. Pressing play carries on past it; going back
 * into the moment pauses it there again. Jumping past the end doesn't pause.
 */
export function usePauseAtMomentEnd(
  postUri: string,
  moment: Pick<Moment, 'endSeconds'> | undefined,
) {
  const endSeconds = moment?.endSeconds
  useEffect(() => {
    if (endSeconds === undefined) return
    let previous = getPlaybackSecond(postUri)
    return subscribePlaybackPositions(() => {
      const current = getPlaybackSecond(postUri)
      if (current === undefined || current === previous) return
      const last = previous
      previous = current
      if (
        last !== undefined &&
        last < endSeconds &&
        current >= endSeconds &&
        current - last <= MAX_PLAYING_STEP_SECONDS
      ) {
        pauseIfVisible(postUri)
      }
    })
  }, [postUri, endSeconds])
}
