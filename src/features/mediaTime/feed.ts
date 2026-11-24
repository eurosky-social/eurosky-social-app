import {type ModerationDecision} from '@bsky/sdk/moderation'

import {type app} from '#/lexicons'
import {getOwnVideoEmbed} from './record'

/**
 * Whether a feed post can show moments: its own video (not a GIF), at least
 * one reply, and content that is not hidden behind a warning.
 */
export function canShowFeedMoments(
  post: Pick<app.bsky.feed.defs.PostView, 'embed' | 'replyCount'>,
  moderation: Pick<ModerationDecision, 'ui'>,
): boolean {
  const video = getOwnVideoEmbed(post.embed)
  return (
    !!video &&
    video.presentation !== 'gif' &&
    (post.replyCount ?? 0) > 0 &&
    !moderation.ui('contentList').blur &&
    !moderation.ui('contentMedia').blur
  )
}
