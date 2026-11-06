import {type ModerationOpts} from '@bsky/sdk/moderation'

import * as ProfileCard from '#/components/ProfileCard'
import type * as bsky from '#/types/bsky'

/** Keep publisher controls on the shared follow queue and its normal copy/permissions. */
export function PublisherFollowButton({
  profile,
  moderationOpts,
}: {
  profile: bsky.profile.AnyProfileView
  moderationOpts: ModerationOpts
}) {
  return (
    <ProfileCard.FollowButton
      profile={profile}
      moderationOpts={moderationOpts}
      logContext="ProfileHeader"
      size="small"
    />
  )
}
