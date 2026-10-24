import {type Un$Typed} from '@atproto/lex'

import {type ImageMeta} from '#/state/gallery'
import {type app} from '#/lexicons'

type ProfileView = Pick<
  app.bsky.actor.defs.ProfileViewDetailed,
  | 'avatar'
  | 'banner'
  | 'displayName'
  | 'description'
  | 'pronouns'
  | 'website'
  | 'links'
>

/** Shared readiness check for object updates and callbacks with explicit fields. */
export function isProfileUpdateCommitted({
  fresh,
  profile,
  updates,
  newUserAvatar,
  newUserBanner,
}: {
  fresh: ProfileView | undefined
  profile: Pick<ProfileView, 'avatar' | 'banner'>
  updates?: Un$Typed<app.bsky.actor.profile.Main>
  newUserAvatar?: ImageMeta | null
  newUserBanner?: ImageMeta | null
}) {
  if (!fresh) return false
  if (
    newUserAvatar !== undefined &&
    (newUserAvatar === null
      ? !!fresh.avatar
      : !fresh.avatar || fresh.avatar === profile.avatar)
  )
    return false
  if (
    newUserBanner !== undefined &&
    (newUserBanner === null
      ? !!fresh.banner
      : !fresh.banner || fresh.banner === profile.banner)
  )
    return false
  if (!updates) return true
  if (
    'links' in updates &&
    (fresh.links ?? []).map(link => link.cid).join() !==
      (updates.links ?? []).map(ref => ref.cid).join()
  )
    return false
  return (
    fresh.displayName === (updates.displayName || undefined) &&
    fresh.description === (updates.description || undefined) &&
    (!('pronouns' in updates) ||
      fresh.pronouns === (updates.pronouns || undefined)) &&
    (!('website' in updates) ||
      fresh.website === (updates.website || undefined))
  )
}
