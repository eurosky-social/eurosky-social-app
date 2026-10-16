import {Fragment} from 'react'
import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import {Divider} from '#/components/Divider'
import * as Skeleton from '#/components/Skeleton'
import {BandRule, ColumnRule} from './Rules'

/** Stories sketched in each column while the spread loads. */
const ROWS_PER_COLUMN = 3

/**
 * The spread's shape before its stories arrive: the lead band (a picture, a
 * headline, and the developing column beside it on a wide spread) and then a
 * band of departments. Laid out with the spread's own rules and proportions,
 * so the page does not jump when the real stories replace it.
 */
export function ExploreSkeleton({
  wide,
  columns,
}: {
  /** Whether the spread reaches into the right column. */
  wide: boolean
  /** Departments per band at the current width. */
  columns: number
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View style={[wide ? a.flex_row : a.flex_col, a.align_stretch]}>
        <View style={[wide ? {flex: 2} : a.w_full, a.p_lg, a.gap_md]}>
          <Block style={[a.w_full, {aspectRatio: 16 / 9}]} />
          <Line style={[a.text_xs, {width: 90}]} />
          <View>
            <Line style={[a.text_3xl]} />
            <Line style={[a.text_3xl, {width: '70%'}]} />
          </View>
          <Line style={[a.text_xs, {width: 120}]} />
        </View>
        {wide ? <ColumnRule /> : <Divider />}
        <View style={[wide ? {flex: 1.3} : a.w_full, a.p_lg, a.gap_md]}>
          <Line style={[a.text_sm, {width: 100}]} />
          {Array.from({length: ROWS_PER_COLUMN}, (_, index) => (
            <Fragment key={index}>
              {index > 0 && <Divider />}
              <StoryRowSkeleton />
            </Fragment>
          ))}
        </View>
      </View>
      <BandRule />
      <View style={[a.flex_row, a.align_stretch]}>
        {Array.from({length: columns}, (_, column) => (
          <Fragment key={column}>
            {column > 0 && <ColumnRule />}
            <View style={[a.flex_1, a.p_lg, a.gap_md]}>
              <Line style={[a.text_sm, {width: 80}]} />
              {Array.from({length: ROWS_PER_COLUMN}, (_, index) => (
                <Fragment key={index}>
                  {index > 0 && <Divider />}
                  <StoryRowSkeleton />
                </Fragment>
              ))}
            </View>
          </Fragment>
        ))}
      </View>
    </View>
  )
}

/** A story row: outlet, a two-line headline and date, beside a thumbnail. */
function StoryRowSkeleton() {
  return (
    <View style={[a.flex_row, a.gap_md]}>
      <View style={[a.flex_1, a.gap_xs]}>
        <Line style={[a.text_xs, {width: 80}]} />
        <View>
          <Line style={[a.text_lg]} />
          <Line style={[a.text_lg, {width: '60%'}]} />
        </View>
        <Line style={[a.text_xs, {width: 70}]} />
      </View>
      <Block style={[{width: 96, height: 72}]} />
    </View>
  )
}

/**
 * One line of placeholder text. `Skeleton.Text` stretches along its parent's
 * main axis, so it sits in a row to take the width rather than the height.
 */
function Line({
  style,
}: {
  style: React.ComponentProps<typeof Skeleton.Text>['style']
}) {
  return (
    <View style={[a.flex_row]}>
      <Skeleton.Text style={style} />
    </View>
  )
}

/** A picture's placeholder, in the skeleton's shade. */
function Block({style}: {style: React.ComponentProps<typeof View>['style']}) {
  const t = useTheme()
  return <View style={[a.rounded_sm, t.atoms.bg_contrast_50, style]} />
}
