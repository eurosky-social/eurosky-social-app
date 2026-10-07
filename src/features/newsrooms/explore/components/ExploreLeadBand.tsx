import {useEffect, useState} from 'react'
import {type LayoutChangeEvent, View} from 'react-native'
import {Trans} from '@lingui/react/macro'

import {atoms as a, tokens} from '#/alf'
import {Divider} from '#/components/Divider'
import {type app} from '#/lexicons'
import {useArticleDiscussionsQuery} from '../../queries'
import {type ExploreStory} from '../cluster'
import {ColumnRule, KickerText} from './Rules'
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

/**
 * The spread's opening band: the day's story, and beside it what else is
 * developing. The lead's other coverage is under its outlet bubbles, like every
 * other story's, rather than listed out in full.
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
   * for its article, rather than one per article on the page.
   */
  const discussions = useArticleDiscussionsQuery({
    urls: lead ? [lead.lead.item.link] : [],
    publisherDid: lead?.lead.publisher.did,
  })

  if (!lead) return null

  const hasColumn = wide ? candidates.length > 0 : developing.length > 0

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
            size="hero"
            story={lead}
            profiles={profiles}
            sharers={discussions[0]?.data?.sharers}
          />
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
              {developingList(developing)}
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
