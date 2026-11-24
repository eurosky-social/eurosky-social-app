import {AtUri} from '@atproto/syntax'

import {IS_WEB} from '#/env'
import {navigate} from '#/Navigation'
import {seekIfVisible} from './playback'

/**
 * Returns a function that plays a post's video from a given second. A player
 * on the current screen jumps in place; otherwise the video opens: on web in
 * the post's thread (whose player picks up the `t` parameter), on iOS and
 * Android in the full-screen player.
 *
 * Uses the global navigate helper, so it also works outside a screen (for
 * example in the composer's preview of the post being replied to).
 */
export function useJumpToMediaTime() {
  return (videoPostUri: string, seconds: number) => {
    if (seekIfVisible(videoPostUri, seconds)) return
    let urip: AtUri
    try {
      urip = new AtUri(videoPostUri)
    } catch {
      return
    }
    const params = {name: urip.host, rkey: urip.rkey, t: String(seconds)}
    void navigate(
      IS_WEB ? {name: 'PostThread', params} : {name: 'PostVideo', params},
    )
  }
}
