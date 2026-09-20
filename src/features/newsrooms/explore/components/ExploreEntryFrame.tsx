import {Fragment} from 'react'
import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {ButtonIcon, ButtonText} from '#/components/Button'
import {Divider} from '#/components/Divider'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon} from '#/components/icons/Chevron'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {
  useArticleDiscussionsQuery,
  useNewsroomProfilesQuery,
} from '../../queries'
import {outletProfile} from '../cluster'
import {useExploreStories} from '../useExploreStories'
import {CoverageEntry} from './ExploreLeadBand'
import {KickerText} from './Rules'
import {StoryLead, StoryRow} from './StoryCard'

/** Stories the frame shows before sending the reader to the full spread. */
const PREVIEW_COUNT = 3

/**
 * The way into the explore spread from the news feed: the day's biggest
 * cross-newsroom stories, sat above the feed as its own band.
 *
 * It reads the same clustered stories the spread does, so opening the feed
 * warms that page's cache - and costs one proxied feed fetch per publisher. It
 * renders nothing until they land, so the feed is never held up by it.
 */
export function ExploreEntryFrame() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {stories, isLoading} = useExploreStories()
  const profiles = useNewsroomProfilesQuery()
  /* One search per outlet on the lead story, shared with the spread's cache. */
  const discussions = useArticleDiscussionsQuery({
    urls: stories[0]?.coverage.map(article => article.item.link) ?? [],
    publisherDid: stories[0]?.lead.publisher.did,
  })

  if (isLoading || stories.length === 0) return null

  const [lead, ...rest] = stories.slice(0, PREVIEW_COUNT)
  const newsrooms = new Set(stories.map(story => story.lead.publisher.id)).size
  const coverage = lead.coverage.slice(1)

  return (
    <View
      style={[a.border_b, t.atoms.border_contrast_low, t.atoms.bg_contrast_25]}>
      <View style={[a.px_lg, a.pt_lg, a.pb_md, a.gap_md]}>
        <View style={[a.flex_row, a.align_center, a.gap_sm]}>
          <KickerText>
            <Trans>What’s happening now</Trans>
          </KickerText>
          <Text style={[a.flex_1, a.text_xs, t.atoms.text_contrast_medium]}>
            {plural(newsrooms, {
              one: '# publisher today',
              other: '# publishers today',
            })}
          </Text>
        </View>

        <StoryLead
          /* The other newsrooms follow in full, as they do on the spread. */
          hideCoverage={coverage.length > 0}
          story={lead}
          profiles={profiles}
        />

        {coverage.length > 0 && (
          <>
            <Divider />
            <KickerText>
              {plural(lead.newsroomCount, {
                one: 'The lead story in # newsroom',
                other: 'The lead story in # newsrooms',
              })}
            </KickerText>
            {coverage.map((article, index) => (
              <Fragment key={article.publisher.id}>
                {index > 0 && <Divider />}
                <CoverageEntry
                  article={article}
                  profile={outletProfile(profiles, article.publisher)}
                  postCount={discussions[index + 1]?.data?.total}
                />
              </Fragment>
            ))}
          </>
        )}

        {rest.map(story => (
          <Fragment key={story.id}>
            <Divider />
            <StoryRow story={story} profiles={profiles} />
          </Fragment>
        ))}
      </View>

      <Divider />
      <Link
        testID="newsFeedExploreLink"
        to="/newsroom/explore"
        label={l`Explore the newsrooms`}
        size="large"
        color="secondary"
        style={[a.rounded_0, a.justify_between, a.px_lg]}>
        <ButtonText>
          <Trans>Explore the newsrooms</Trans>
        </ButtonText>
        <ButtonIcon icon={ChevronRightIcon} />
      </Link>
    </View>
  )
}
