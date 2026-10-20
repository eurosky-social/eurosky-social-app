import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import * as ModuleHeader from '#/screens/Search/components/ModuleHeader'
import {atoms as a, useTheme} from '#/alf'
import {ButtonText} from '#/components/Button'
import {Newspaper2_Stroke2_Corner2_Rounded as FrontpagesIcon} from '#/components/icons/Newspaper2'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {
  type Frontpage,
  frontpagePath,
  storyCount,
  useFrontpageProfiles,
  useFrontpages,
} from '#/features/frontpages/frontpages'
import {ExploreLiveSportsWidget} from '#/features/liveSports/components/ExploreLiveSportsWidget'
import {OutletIcon} from '#/features/news/explore/components/OutletIcon'
import {getPublisherName} from '#/features/news/publishers'
import {type app} from '#/lexicons'
import {selectSources} from '../sources'
import {useNewsFeedPrefsQuery} from '../state/prefs'

/**
 * The news feed's right column: the mirror of the frontpage rail's "Your News"
 * module, pointing the other way - into the publisher hubs - plus the same
 * cross-network live sports context.
 */
export function NewsFeedRightRail() {
  return (
    <View>
      <OutletsModule />
      <ExploreLiveSportsWidget />
    </View>
  )
}

/** How many outlets the module features when the feed names none. */
const FEATURED_COUNT = 8

function OutletsModule() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {data: prefs} = useNewsFeedPrefsQuery()
  const {frontpages} = useFrontpages()

  // With a configured feed, feature the outlets already among its sources;
  // without one (or when none of its sources is an outlet), feature the
  // outlets with the most current stories.
  const sourceDids =
    prefs && prefs.topics.length > 0
      ? new Set(
          selectSources({
            topics: prefs.topics,
            regions: prefs.regions,
            excludedDids: prefs.excludedDids,
          }).map(source => source.did),
        )
      : null
  const fromFeed =
    sourceDids && frontpages
      ? frontpages.filter(
          frontpage => frontpage.did && sourceDids.has(frontpage.did),
        )
      : []
  const featured =
    fromFeed.length > 0
      ? fromFeed
      : [...(frontpages ?? [])]
          .sort((x, y) => storyCount(y) - storyCount(x))
          .slice(0, FEATURED_COUNT)
  const profiles = useFrontpageProfiles(featured)

  /* Outlets come from the news aggregator; without it there are none. */
  if (featured.length === 0) return null

  return (
    <View style={[a.pb_xl]}>
      <ModuleHeader.Container>
        <ModuleHeader.Icon icon={FrontpagesIcon} />
        <ModuleHeader.TitleText>{l`Your outlets`}</ModuleHeader.TitleText>
      </ModuleHeader.Container>
      <View style={[a.px_lg, a.gap_md]}>
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {fromFeed.length > 0 ? (
            <Trans>Outlets from the sources in your news feed</Trans>
          ) : (
            <Trans>The outlets with the most stories right now</Trans>
          )}
        </Text>
        <View style={[a.gap_md]}>
          {featured.map(frontpage => (
            <FeaturedFrontpage
              key={frontpage.slug}
              frontpage={frontpage}
              profile={frontpage.did ? profiles.get(frontpage.did) : undefined}
            />
          ))}
        </View>
        <Link
          to="/outlets"
          label={l`See all outlets`}
          color="primary"
          size="large"
          style={[a.w_full, a.justify_center]}>
          <ButtonText>
            <Trans>See all outlets</Trans>
          </ButtonText>
        </Link>
      </View>
    </View>
  )
}

function FeaturedFrontpage({
  frontpage,
  profile,
}: {
  frontpage: Frontpage
  profile?: app.bsky.actor.defs.ProfileViewDetailed
}) {
  const {t: l} = useLingui()
  const name = getPublisherName(profile) || frontpage.name

  return (
    <Link
      to={frontpagePath(frontpage)}
      label={l`Open the ${name} frontpage`}
      style={[a.flex_row, a.align_center, a.gap_sm]}>
      <OutletIcon
        outlet={{
          id: frontpage.slug,
          did: frontpage.did,
          name: frontpage.name,
          site: frontpage.domains[0],
          categories: [],
        }}
        profile={profile}
        size={28}
      />
      <Text emoji numberOfLines={1} style={[a.flex_1, a.text_sm, a.font_bold]}>
        {name}
      </Text>
    </Link>
  )
}
