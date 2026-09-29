import {Fragment, useEffect, useState} from 'react'
import {type LayoutChangeEvent, View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, tokens, useTheme} from '#/alf'
import {Divider} from '#/components/Divider'
import {InlineLinkText, Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {articleViewLink} from '../../article/articleLink'
import {articleSearchPath} from '../../discussion'
import {type ArticleSharers, useArticleDiscussionsQuery} from '../../queries'
import {type ExploreArticle, type ExploreStory, outletProfile} from '../cluster'
import {ColumnRule, KickerText} from './Rules'
import {PublisherLabel, sharedByLabel} from './StoryByline'
import {StoryLead, StoryRow} from './StoryCard'

/**
 * How many stories run beside the lead before its column is measured, and on
 * narrow screens, where the columns stack and there is nothing to balance.
 */
const DEVELOPING_COUNT = 3

/** The most stories the second column may take to match a tall lead. */
const MAX_DEVELOPING_COUNT = 8

/** Stories the band may show: the lead plus the most it can run beside it. */
export const LEAD_BAND_MAX_STORIES = 1 + MAX_DEVELOPING_COUNT

/** Stories the band shows until it has measured itself. */
export const LEAD_BAND_DEFAULT_STORIES = 1 + DEVELOPING_COUNT

/** Other newsrooms' versions of the lead shown side by side under it. */
const COVERAGE_PER_ROW = 3

/**
 * The spread's opening band: the day's story with what every other newsroom
 * made of it, and beside it what else is developing.
 *
 * On a wide spread the two columns are balanced: the second column takes as
 * many developing stories as fit beside the lead, rather than a fixed number
 * that leaves one column or the other trailing into white space. Headlines and
 * images vary too much in height for a count to do that, so the band measures.
 */
export function ExploreLeadBand({
  stories,
  profiles,
  wide,
  onShownCountChange,
}: {
  /**
   * Ranked stories; the first leads and the rest are candidates for the second
   * column. Pass up to `LEAD_BAND_MAX_STORIES`.
   */
  stories: ExploreStory[]
  profiles: Map<string, app.bsky.actor.defs.ProfileViewDetailed>
  /** Whether the spread reaches into the right column. */
  wide: boolean
  /**
   * How many of `stories` the band ended up showing, lead included, so the page
   * does not repeat them further down.
   */
  onShownCountChange?: (count: number) => void
}) {
  const {t: l} = useLingui()
  const [lead, ...rest] = stories
  const candidates = rest.slice(0, MAX_DEVELOPING_COUNT)
  /** Height of the lead column's content, excluding its padding. */
  const [leadHeight, setLeadHeight] = useState<number | null>(null)
  /** Where each candidate's bottom edge would fall in the second column. */
  const [bottoms, setBottoms] = useState<(number | undefined)[]>([])

  const developingCount = wide
    ? fitCount(candidates.length, bottoms, leadHeight)
    : Math.min(DEVELOPING_COUNT, candidates.length)
  const developing = candidates.slice(0, developingCount)

  useEffect(() => {
    onShownCountChange?.(lead ? 1 + developingCount : 0)
  }, [lead, developingCount, onShownCountChange])

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
  /*
   * Counted from the coverage listed under it, so the heading never promises
   * outlets the reader cannot find in the list.
   */
  const otherOutlets = new Set(
    coverage
      .map(article => article.publisher.id)
      .filter(id => id !== lead.lead.publisher.id),
  ).size
  const coverageKicker =
    otherOutlets > 0
      ? plural(otherOutlets, {
          one: '# more newsroom covered this',
          other: '# more newsrooms covered this',
        })
      : l`More on this story`
  /*
   * On a wide spread the other newsrooms' versions run under the lead, in
   * rows, rather than stacked beside it, so the second column carries one
   * list and the lead column is more than a picture and a headline.
   */
  const coverageUnderLead = wide && coverage.length > 0
  const hasColumn = wide
    ? candidates.length > 0
    : coverage.length > 0 || developing.length > 0

  function onLeadLayout(event: LayoutChangeEvent) {
    const next = event.nativeEvent.layout.height
    setLeadHeight(prev => (prev === next ? prev : next))
  }

  function onCandidateLayout(index: number, event: LayoutChangeEvent) {
    const {y, height} = event.nativeEvent.layout
    const next = y + height
    setBottoms(prev => {
      if (prev[index] === next) return prev
      const copy = [...prev]
      copy[index] = next
      return copy
    })
  }

  const developingList = (
    items: ExploreStory[],
    onItemLayout?: (index: number, event: LayoutChangeEvent) => void,
  ) => (
    <>
      <KickerText>
        <Trans>Developing</Trans>
      </KickerText>
      {items.map((story, index) => (
        <View
          key={story.id}
          style={[a.gap_md]}
          onLayout={onItemLayout && (event => onItemLayout(index, event))}>
          {index > 0 && <Divider />}
          <StoryRow story={story} profiles={profiles} />
        </View>
      ))}
    </>
  )

  return (
    <View style={[wide ? a.flex_row : a.flex_col, a.align_stretch]}>
      <View style={[wide ? {flex: 2} : a.w_full, a.p_lg]}>
        <View style={[a.gap_lg]} onLayout={wide ? onLeadLayout : undefined}>
          <StoryLead
            /* The other newsrooms are listed in full beside or under it. */
            hideCoverage={coverage.length > 0}
            size="hero"
            story={lead}
            profiles={profiles}
            sharers={discussions[0]?.data?.sharers}
          />
          {coverageUnderLead && (
            <View style={[a.gap_md]}>
              <Divider />
              <KickerText>{coverageKicker}</KickerText>
              {chunk(coverage, COVERAGE_PER_ROW).map((row, rowIndex) => (
                <View
                  key={row.map(article => article.item.link).join(',')}
                  style={[a.gap_md]}>
                  {rowIndex > 0 && <Divider />}
                  <View style={[a.flex_row, a.align_stretch, a.gap_md]}>
                    {row.map((article, index) => (
                      <Fragment key={article.item.link}>
                        {index > 0 && <ColumnRule />}
                        <View style={[a.flex_1]}>
                          <CoverageEntry
                            article={article}
                            profile={outletProfile(profiles, article.publisher)}
                            sharers={
                              discussions[
                                rowIndex * COVERAGE_PER_ROW + index + 1
                              ]?.data?.sharers
                            }
                          />
                        </View>
                      </Fragment>
                    ))}
                    {/* Keeps a short last row in its columns. */}
                    {Array.from(
                      {length: COVERAGE_PER_ROW - row.length},
                      (_, index) => (
                        <View key={`empty-${index}`} style={[a.flex_1]} />
                      ),
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {hasColumn && (
        <>
          {wide ? <ColumnRule /> : <Divider />}
          {wide ? (
            <View style={[{flex: 1.3}, a.overflow_hidden]}>
              <View style={[a.p_lg, a.gap_md]}>
                {developing.length > 0 && developingList(developing)}
              </View>
              {/* Every candidate laid out invisibly, at the column's width,
               * so the band knows how many fit before it shows them. It is
               * absolutely positioned so it never adds to the band's height. */}
              <View
                aria-hidden
                pointerEvents="none"
                style={[
                  a.absolute,
                  a.p_lg,
                  a.gap_md,
                  {top: 0, left: 0, right: 0, opacity: 0},
                ]}>
                {developingList(candidates, onCandidateLayout)}
              </View>
            </View>
          ) : (
            <View style={[a.w_full, a.p_lg, a.gap_md]}>
              {coverage.length > 0 && (
                <>
                  <KickerText>{coverageKicker}</KickerText>
                  {coverage.map((article, index) => (
                    <View key={article.item.link} style={[a.gap_md]}>
                      {index > 0 && <Divider />}
                      <CoverageEntry
                        article={article}
                        profile={outletProfile(profiles, article.publisher)}
                        sharers={discussions[index + 1]?.data?.sharers}
                      />
                    </View>
                  ))}
                </>
              )}
              {developing.length > 0 && (
                <>
                  {coverage.length > 0 && <Divider />}
                  {developingList(developing)}
                </>
              )}
            </View>
          )}
        </>
      )}
    </View>
  )
}

/**
 * How many candidates fit beside the lead: every one whose bottom edge lands
 * within the lead column's height. Both columns share the same padding, so the
 * lead's content height plus one padding is the second column's usable depth.
 * At least one always shows, and until everything is measured the default
 * count stands in.
 */
function fitCount(
  total: number,
  bottoms: (number | undefined)[],
  leadHeight: number | null,
): number {
  const fallback = Math.min(DEVELOPING_COUNT, total)
  if (leadHeight === null) return fallback
  const measured = bottoms.slice(0, total)
  if (measured.length < total || measured.some(b => b === undefined)) {
    return fallback
  }
  const limit = leadHeight + tokens.space.lg
  let count = 0
  while (count < total && (measured[count] as number) <= limit) count += 1
  return Math.max(1, count)
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size))
  }
  return rows
}

/** One other newsroom's version of the lead story: its headline, its posts. */
export function CoverageEntry({
  article,
  profile,
  sharers,
}: {
  article: ExploreArticle
  profile?: app.bsky.actor.defs.ProfileViewDetailed
  sharers?: ArticleSharers
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
      {!!sharers?.count && (
        <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
          <InlineLinkText
            to={articleSearchPath(article.item.link)}
            label={l`See this story in the Atmosphere`}
            style={[a.text_xs]}>
            {sharedByLabel(sharers)}
          </InlineLinkText>
        </Text>
      )}
    </View>
  )
}
