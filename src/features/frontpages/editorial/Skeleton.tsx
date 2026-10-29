import {View} from 'react-native'

import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import * as Skeleton from '#/components/Skeleton'
import {
  ExploreColumn,
  ExploreSpreadBorders,
  useExploreSpread,
} from '#/features/news/explore/components/ExploreColumn'
import {ExploreSkeleton} from '#/features/news/explore/components/ExploreSkeleton'

/**
 * The front page before its publication resolves: the top bar and spread in
 * placeholder shades, in the same column, borders and rules as
 * `EditorialFrontpage`, so nothing jumps when the real page replaces it.
 */
export function EditorialFrontpageSkeleton() {
  const t = useTheme()
  const {wide} = useExploreSpread()
  return (
    <>
      <ExploreSpreadBorders />
      <ExploreColumn style={[a.px_lg, wide && a.px_2xl, a.pb_4xl]}>
        <View
          style={[
            a.flex_row,
            a.align_center,
            a.gap_md,
            a.py_md,
            a.border_b,
            t.atoms.border_contrast_high,
          ]}>
          <View style={[a.flex_row, a.flex_1, a.align_center, a.gap_sm]}>
            <Layout.Header.BackButton />
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[a.flex_row, a.flex_1, a.align_center, a.gap_sm]}>
              <Skeleton.Block style={[a.rounded_sm, {width: 32, height: 32}]} />
              <View style={[a.flex_1, a.gap_2xs]}>
                <Line style={[a.text_md, {width: 160}]} />
                <Line style={[a.text_xs, {width: 110}]} />
              </View>
            </View>
          </View>
          <Skeleton.Block style={[a.rounded_full, {width: 132, height: 33}]} />
        </View>
        <ExploreSkeleton wide={wide} columns={wide ? 3 : 1} />
      </ExploreColumn>
    </>
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
