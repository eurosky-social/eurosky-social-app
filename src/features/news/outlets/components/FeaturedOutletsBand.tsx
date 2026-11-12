import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import {InlineLinkText} from '#/components/Link'
import {useFrontpageProfiles} from '#/features/frontpages/frontpages'
import {type NewsInterest} from '#/features/newsFeed/state/prefs'
import {useDutchOutletsQuery} from '../../dutch/queries'
import {BandRule, KickerText} from '../../explore/components/Rules'
import {FEATURED_ON_NEWS_PAGE} from '../config'
import {featuredForInterest, useFeaturedOutlets} from '../featured'
import {FeaturedOutletCard} from './FeaturedOutletCard'

/**
 * The news page's featured outlets: a few cards, each leading to the outlet's
 * frontpage, and the way into the outlets tab, closed by a rule. With an
 * interest picked, they are that interest's outlets (see
 * `featuredForInterest`). Renders nothing until they load and nothing where
 * there are none, so it never holds the news up.
 */
export function FeaturedOutletsBand({
  wide,
  interest,
}: {
  wide: boolean
  interest?: NewsInterest
}) {
  const {t: l} = useLingui()
  const featured = useFeaturedOutlets({limit: FEATURED_ON_NEWS_PAGE})
  const {outlets: all} = useDutchOutletsQuery({enabled: !!interest})
  const outlets = interest
    ? all
      ? featuredForInterest(
          interest,
          all,
          FEATURED_ON_NEWS_PAGE,
          featured.outlets.map(outlet => outlet.slug),
        )
      : []
    : featured.outlets
  const profiles = useFrontpageProfiles(outlets)

  if (outlets.length === 0) return null

  return (
    <>
      <View testID="featuredOutletsBand" style={[a.px_lg, a.py_lg, a.gap_md]}>
        <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_md]}>
          <KickerText>
            <Trans>Featured outlets</Trans>
          </KickerText>
          <InlineLinkText
            to="/news/outlets"
            label={l`See all featured outlets`}
            style={[a.text_sm]}>
            <Trans>See all</Trans>
          </InlineLinkText>
        </View>
        <View style={[wide ? a.flex_row : a.flex_col, a.gap_md]}>
          {outlets.map(outlet => (
            <FeaturedOutletCard
              key={outlet.slug}
              outlet={outlet}
              profile={outlet.did ? profiles.get(outlet.did) : undefined}
            />
          ))}
          {/* Keeps a short row in its columns rather than stretching it. */}
          {wide &&
            Array.from(
              {length: FEATURED_ON_NEWS_PAGE - outlets.length},
              (_, index) => <View key={`empty-${index}`} style={[a.flex_1]} />,
            )}
        </View>
      </View>
      <BandRule />
    </>
  )
}
