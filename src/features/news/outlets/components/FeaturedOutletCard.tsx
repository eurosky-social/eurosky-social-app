import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme, web} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {frontpagePath} from '#/features/frontpages/frontpages'
import {type app} from '#/lexicons'
import {OutletIcon} from '../../explore/components/OutletIcon'
import {getPublisherName} from '../../publishers'
import {type FeaturedOutlet} from '../featured'

/**
 * A featured outlet on the news page: its mark, name and what it says about
 * itself, the whole card leading to its frontpage.
 */
export function FeaturedOutletCard({
  outlet,
  profile,
}: {
  outlet: FeaturedOutlet
  profile?: app.bsky.actor.defs.ProfileViewDetailed
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const name = getPublisherName(profile) || outlet.name
  const handle = profile?.handle ? `@${profile.handle}` : outlet.site
  const description = profile?.description?.trim()

  return (
    <Link
      testID={`featuredOutlet-${outlet.slug}`}
      to={frontpagePath(outlet)}
      label={l`Open ${name}’s front page`}
      style={[
        a.flex_1,
        a.flex_col,
        a.align_stretch,
        a.gap_sm,
        a.p_lg,
        a.rounded_md,
        a.border,
        t.atoms.border_contrast_low,
        t.atoms.bg,
        web({cursor: 'pointer'}),
      ]}>
      {({hovered, pressed}) => (
        <>
          <View style={[a.flex_row, a.align_center, a.gap_md]}>
            <OutletIcon
              outlet={outletIconOf(outlet)}
              profile={profile}
              size={40}
            />
            <View style={[a.flex_1, a.gap_2xs]}>
              <Text
                emoji
                numberOfLines={1}
                style={[
                  a.text_md,
                  a.font_bold,
                  a.leading_tight,
                  t.atoms.text,
                  (hovered || pressed) && {textDecorationLine: 'underline'},
                ]}>
                {name}
              </Text>
              {!!handle && (
                <Text
                  numberOfLines={1}
                  style={[a.text_sm, t.atoms.text_contrast_medium]}>
                  {handle}
                </Text>
              )}
            </View>
          </View>
          {!!description && (
            <Text
              emoji
              numberOfLines={2}
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_high]}>
              {description}
            </Text>
          )}
        </>
      )}
    </Link>
  )
}

/** A featured outlet as the shared outlet mark takes it. */
export function outletIconOf(outlet: FeaturedOutlet) {
  return {
    id: outlet.slug,
    slug: outlet.slug,
    did: outlet.did,
    name: outlet.name,
    site: outlet.site,
    categories: [],
  }
}
