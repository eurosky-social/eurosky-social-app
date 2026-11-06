import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {findPublisherByDid} from './publishers'

/** Moderated source badge, separate from the article and its conversation link. */
export function PublisherByline({
  profile,
}: {
  profile: app.bsky.actor.defs.ProfileViewBasic
}) {
  const publisher = findPublisherByDid(profile.did)
  const opts = useModerationOpts()
  const t = useTheme()
  if (!publisher || !opts) return null
  return (
    <Link
      testID="publisherByline"
      to={{screen: 'Publisher', params: {publisher: publisher.id}}}
      label={publisher.name}
      style={[
        a.flex_row,
        a.align_center,
        a.self_start,
        a.gap_sm,
        a.rounded_full,
        a.px_sm,
        a.py_xs,
        t.name === 'dim' ? t.atoms.bg_contrast_100 : t.atoms.bg_contrast_25,
      ]}>
      <ProfileCard.Avatar
        profile={profile}
        moderationOpts={opts}
        size={22}
        disabledPreview
      />
      <Text style={[a.text_xs, a.font_semi_bold]}>{publisher.name}</Text>
    </Link>
  )
}
