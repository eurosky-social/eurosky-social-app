import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {Earth_Stroke2_Corner2_Rounded as WorldIcon} from '#/components/icons/Globe'
import {PinLocation_Stroke2_Corner0_Rounded as PinIcon} from '#/components/icons/PinLocation'
import {
  type Frontpage,
  storyCount,
  useFrontpageProfiles,
} from '#/features/frontpages/frontpages'
import {type NewsInterest} from '#/features/newsFeed/state/prefs'
import {OutletIcon} from './OutletIcon'

/** How many outlets' logos illustrate an interest. */
const LOGO_COUNT = 3

/**
 * An interest at a glance: a globe for one from everywhere or a pin for one
 * with places, then a few of its outlets as overlapping logos - the busiest
 * ones - as the coverage line under a story shows the outlets that ran it.
 */
export function InterestLogos({
  interest,
  frontpages,
  size = 18,
}: {
  interest: NewsInterest
  frontpages: Frontpage[]
  size?: number
}) {
  const t = useTheme()
  const shown = [...frontpages]
    .sort((x, y) => storyCount(y) - storyCount(x))
    .slice(0, LOGO_COUNT)
  const profiles = useFrontpageProfiles(shown)
  const everywhere =
    interest.countries.length === 0 && interest.subLocations.length === 0
  const PlaceIcon = everywhere ? WorldIcon : PinIcon
  const bubble = [
    a.rounded_full,
    a.border,
    t.atoms.bg,
    {borderColor: t.atoms.bg.backgroundColor},
  ]

  return (
    <View style={[a.flex_row, a.align_center]}>
      <View
        style={[
          bubble,
          a.align_center,
          a.justify_center,
          t.atoms.bg_contrast_50,
          {width: size + 2, height: size + 2},
        ]}>
        <PlaceIcon
          width={size - 6}
          height={size - 6}
          style={{color: t.palette.primary_500}}
        />
      </View>
      {shown.map(frontpage => (
        <View key={frontpage.slug} style={[bubble, {marginLeft: -6}]}>
          <OutletIcon
            outlet={outletOfFrontpage(frontpage)}
            profile={frontpage.did ? profiles.get(frontpage.did) : undefined}
            size={size}
          />
        </View>
      ))}
    </View>
  )
}

/** A frontpage as `OutletIcon` takes an outlet. */
export function outletOfFrontpage(frontpage: Frontpage) {
  return {
    id: frontpage.slug,
    did: frontpage.did,
    name: frontpage.name,
    site: frontpage.domains[0],
    categories: [],
  }
}
