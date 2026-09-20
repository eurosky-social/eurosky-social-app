import {Fragment} from 'react'
import {View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Divider} from '#/components/Divider'
import {ChevronLeft_Stroke2_Corner0_Rounded as ChevronLeftIcon} from '#/components/icons/Chevron'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {type ExploreStory} from '../cluster'
import {type ExploreSection} from '../sections'
import {StripStory} from './ExploreDepartment'
import {ExploreLeadBand} from './ExploreLeadBand'
import {BandRule, ColumnRule, KickerText} from './Rules'
import {StoryRow} from './StoryCard'

/** Stories the section's own lead band takes before the grid starts. */
const LEAD_BAND_COUNT = 5

/** Grid rows of picture stories before the rest run as plain headlines. */
const GRID_ROWS = 2

/**
 * One department on its own. It keeps the spread's shape rather than dropping
 * the reader into a list: the section's own lead band, then its stories as a
 * grid of pictures, then the tail as headlines.
 */
export function ExploreSectionFront({
  section,
  stories,
  profiles,
  wide,
  columns,
  onClear,
}: {
  section: ExploreSection
  stories: ExploreStory[]
  profiles: Map<string, app.bsky.actor.defs.ProfileViewDetailed>
  /** Whether the spread reaches into the right column. */
  wide: boolean
  /** How many stories fit across a grid row at this width. */
  columns: number
  /** Back to every topic. */
  onClear: () => void
}) {
  const t = useTheme()
  const {i18n, t: l} = useLingui()
  const name = i18n._(section.label)

  const lead = stories.slice(0, LEAD_BAND_COUNT)
  const afterLead = stories.slice(LEAD_BAND_COUNT)
  const gridCount = Math.min(afterLead.length, columns * GRID_ROWS)
  const grid = afterLead.slice(0, gridCount)
  const tail = afterLead.slice(gridCount)
  const rows: ExploreStory[][] = []
  for (let i = 0; i < grid.length; i += columns) {
    rows.push(grid.slice(i, i + columns))
  }

  return (
    <View>
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.gap_md,
          a.px_lg,
          a.py_md,
          a.flex_wrap,
        ]}>
        <Text
          accessibilityRole="header"
          style={[a.text_2xl, a.font_bold, a.text_left, t.atoms.text]}>
          {name}
        </Text>
        <Text style={[a.flex_1, a.text_sm, t.atoms.text_contrast_medium]}>
          {plural(stories.length, {
            one: '# story across the newsrooms',
            other: '# stories across the newsrooms',
          })}
        </Text>
        <Button
          label={l`Show every topic`}
          size="small"
          color="secondary"
          onPress={onClear}>
          <ButtonIcon icon={ChevronLeftIcon} />
          <ButtonText>
            <Trans>All topics</Trans>
          </ButtonText>
        </Button>
      </View>

      <ExploreLeadBand stories={lead} profiles={profiles} wide={wide} />

      {rows.map((row, rowIndex) => (
        <Fragment key={row[0].id}>
          <BandRule />
          <View style={[a.flex_row, a.align_stretch]}>
            {row.map((story, index) => (
              <Fragment key={story.id}>
                {index > 0 && <ColumnRule />}
                <View style={[a.flex_1, a.p_lg]}>
                  <StripStory story={story} profiles={profiles} />
                </View>
              </Fragment>
            ))}
            {/* An unfilled last row keeps its columns' width rather than
             * stretching two stories across the page. */}
            {row.length < columns &&
              Array.from({length: columns - row.length}, (_, index) => (
                <View key={`empty-${rowIndex}-${index}`} style={[a.flex_1]} />
              ))}
          </View>
        </Fragment>
      ))}

      {tail.length > 0 && (
        <>
          <BandRule />
          <View style={[a.p_lg, a.gap_md]}>
            <KickerText>
              <Trans>More in {name}</Trans>
            </KickerText>
            <View style={[wide ? a.flex_row : a.flex_col, a.gap_lg]}>
              {chunkEvenly(tail, wide ? 2 : 1).map((column, columnIndex) => (
                <View
                  key={column[0]?.id ?? columnIndex}
                  style={[a.flex_1, a.gap_md]}>
                  {column.map((story, index) => (
                    <Fragment key={story.id}>
                      {index > 0 && <Divider />}
                      <StoryRow story={story} profiles={profiles} />
                    </Fragment>
                  ))}
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  )
}

/** Splits a list into `count` columns of near-equal length, in reading order. */
function chunkEvenly<T>(items: T[], count: number): T[][] {
  const perColumn = Math.ceil(items.length / count)
  const columns: T[][] = []
  for (let i = 0; i < items.length; i += perColumn) {
    columns.push(items.slice(i, i + perColumn))
  }
  return columns
}
