import {AtUri} from '@atproto/syntax'

import {navigate} from '#/Navigation'

/**
 * Opens a video's insights for its author (route PostInsights).
 *
 * Uses the global navigate helper, so it also works outside a screen.
 */
export function openInsights(videoPostUri: string) {
  let urip: AtUri
  try {
    urip = new AtUri(videoPostUri)
  } catch {
    return
  }
  void navigate({
    name: 'PostInsights',
    params: {name: urip.host, rkey: urip.rkey},
  })
}
