import {AtUri} from '@atproto/syntax'

import {navigate} from '#/Navigation'

/**
 * Opens a moment's page: its comments, with the video playing from
 * `seconds`, the moment's start. The page shows whichever moment holds that
 * second when it loads.
 *
 * Uses the global navigate helper, so it also works outside a screen.
 */
export function openMoment(videoPostUri: string, seconds: number) {
  let urip: AtUri
  try {
    urip = new AtUri(videoPostUri)
  } catch {
    return
  }
  void navigate({
    name: 'PostMoment',
    params: {name: urip.host, rkey: urip.rkey, t: String(seconds)},
  })
}
