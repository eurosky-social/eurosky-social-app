import {AtUri} from '@atproto/syntax'

import {navigate} from '#/Navigation'
import {getCommentableMediaTime} from './playback'

/**
 * Opens a video with its moments (route PostVideo), going on from where it
 * was last watched in this app, if recently.
 *
 * Uses the global navigate helper, so it also works outside a screen.
 */
export function openWatching(videoPostUri: string) {
  let urip: AtUri
  try {
    urip = new AtUri(videoPostUri)
  } catch {
    return
  }
  const seconds = getCommentableMediaTime(videoPostUri)
  void navigate({
    name: 'PostVideo',
    params: {
      name: urip.host,
      rkey: urip.rkey,
      ...(seconds !== undefined ? {t: String(seconds)} : {}),
    },
  })
}
