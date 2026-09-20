import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Divider} from '#/components/Divider'
import {InlineLinkText, Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {articleViewLink} from '../../article/articleLink'
import {articleSearchPath} from '../../discussion'
import {useArticleDiscussionsQuery} from '../../queries'
import {type ExploreArticle, type ExploreStory, outletProfile} from '../cluster'
import {ColumnRule, KickerText} from './Rules'
import {PublisherLabel} from './StoryByline'
import {StoryLead, StoryRow} from './StoryCard'

/** How many stories run beside the lead before the departments start. */
const DEVELOPING_COUNT = 3

/**
 * The spread's opening band: the day's story, and beside it a column carrying
 * what every other newsroom made of that story, then what else is developing.
 * Two columns rather than three - a third only squeezed the two that carry the
 * news.
 */
export function ExploreLeadBand({
  stories,
  profiles,
  wide,
}: {
  /** Ranked stories; the first leads and the next few fill the second column. */
  stories: ExploreStory[]
  profiles: Map<string, app.bsky.actor.defs.ProfileViewDetailed>
  /** Whether the spread reaches into the right column. */
  wide: boolean
}) {
  const [lead, ...rest] = stories
  const developing = rest.slice(0, DEVELOPING_COUNT)

  /*
   * The lead is the only story whose Atmosphere pull is looked up: one search
   * per outlet covering it, rather than one per article on the page.
   */
  const discussions = useArticleDiscussionsQuery({
    urls: lead?.coverage.map(article => article.item.link) ?? [],
    publisherDid: lead?.lead.publisher.did,
  })

  if (!lead) return null

  const coverage = lead.coverage.slice(1)
  const hasColumn = coverage.length > 0 || developing.length > 0

  return (
    <View style={[wide ? a.flex_row : a.flex_col, a.align_stretch]}>
      <View style={[wide ? {flex: 2} : a.w_full, a.p_lg, a.gap_sm]}>
        <StoryLead
          /* The other newsrooms are listed in full in the column beside it. */
          hideCoverage={coverage.length > 0}
          size="hero"
          story={lead}
          profiles={profiles}
          postCount={discussions[0]?.data?.total}
        />
      </View>

      {hasColumn && (
        <>
          {wide ? <ColumnRule /> : <Divider />}
          <View style={[wide ? {flex: 1.3} : a.w_full, a.p_lg, a.gap_md]}>
            {coverage.length > 0 && (
              <>
                <KickerText>
                  {plural(lead.newsroomCount, {
                    one: 'The lead story in # newsroom',
                    other: 'The lead story in # newsrooms',
                  })}
                </KickerText>
                {coverage.map((article, index) => (
                  <View key={article.publisher.id} style={[a.gap_md]}>
                    {index > 0 && <Divider />}
                    <CoverageEntry
                      article={article}
                      profile={outletProfile(profiles, article.publisher)}
                      postCount={discussions[index + 1]?.data?.total}
                    />
                  </View>
                ))}
              </>
            )}

            {developing.length > 0 && (
              <>
                {coverage.length > 0 && <Divider />}
                <KickerText>
                  <Trans>Developing</Trans>
                </KickerText>
                {developing.map((story, index) => (
                  <View key={story.id} style={[a.gap_md]}>
                    {index > 0 && <Divider />}
                    <StoryRow story={story} profiles={profiles} />
                  </View>
                ))}
              </>
            )}
          </View>
        </>
      )}
    </View>
  )
}

/** One other newsroom's version of the lead story: its headline, its posts. */
export function CoverageEntry({
  article,
  profile,
  postCount,
}: {
  article: ExploreArticle
  profile?: app.bsky.actor.defs.ProfileViewDetailed
  postCount?: number
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  return (
    <View style={[a.gap_xs]}>
      <PublisherLabel article={article} profile={profile} />
      <Link
        to={articleViewLink(article)}
        label={article.item.title}
        style={[a.flex_col, a.align_start, a.w_full]}>
        <Text
          numberOfLines={3}
          style={[a.text_sm, a.font_bold, a.leading_snug, t.atoms.text]}>
          {article.item.title}
        </Text>
      </Link>
      {!!postCount && (
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          <InlineLinkText
            to={articleSearchPath(article.item.link)}
            label={l`See this story in the Atmosphere`}
            style={[a.text_xs]}>
            {plural(postCount, {one: '# post', other: '# posts'})}
          </InlineLinkText>
        </Text>
      )}
    </View>
  )
}
