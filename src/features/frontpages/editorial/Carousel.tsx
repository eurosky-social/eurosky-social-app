import {Children} from 'react'
import {ScrollView, View} from 'react-native'

import {atoms as a, useBreakpoints, web} from '#/alf'

/**
 * A row of story cards that scrolls sideways, one card at a time on web. Each
 * card is as wide as a reader takes in at a glance, whatever the spread's width.
 */
export function Carousel({children}: {children: React.ReactNode}) {
  const {gtMobile} = useBreakpoints()
  const width = gtMobile ? 260 : 220
  return (
    <ScrollView
      testID="frontpageCarousel"
      horizontal
      showsHorizontalScrollIndicator
      style={[a.mt_lg, web({scrollSnapType: 'x mandatory'})]}
      contentContainerStyle={[a.gap_lg, a.pb_md]}>
      {Children.map(children, child => (
        <View style={[{width}, web({scrollSnapAlign: 'start'})]}>{child}</View>
      ))}
    </ScrollView>
  )
}
