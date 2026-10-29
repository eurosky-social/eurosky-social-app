import {isBlockedOrBlocking, isMuted} from '#/lib/moderation/blocked-and-muted'
import {type app} from '#/lexicons'

/** Follow the full pack, not just its preview; never follow opted-out, muted, blocked or existing follows. */
export function starterPackFollowCandidates(
  members: app.bsky.graph.defs.ListItemView[],
  viewer: string,
) {
  return [
    ...new Set(
      members
        .filter(
          item =>
            !item.subjectOptedOut &&
            item.subject.did !== viewer &&
            !item.subject.viewer?.following &&
            !isBlockedOrBlocking(item.subject) &&
            !isMuted(item.subject),
        )
        .map(item => item.subject.did),
    ),
  ]
}
