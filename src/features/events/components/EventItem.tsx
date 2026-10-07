import {View} from 'react-native'
import {Image} from 'expo-image'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {type EventRecord} from '../types'
import {getEventImage} from '../util'

const IMAGE_SIZE = 64

export function EventItem({event}: {event: EventRecord}) {
  const t = useTheme()
  const {i18n} = useLingui()
  const {startsAt} = event.value
  const startDate = typeof startsAt === 'string' ? new Date(startsAt) : null
  const image = getEventImage(event)

  return (
    <View
      style={[
        a.flex_row,
        a.gap_md,
        a.px_xl,
        a.py_lg,
        a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      {image && (
        <Image
          source={{uri: image.url}}
          alt={image.alt}
          accessibilityIgnoresInvertColors
          loading="lazy"
          style={[
            a.rounded_sm,
            t.atoms.bg_contrast_25,
            {width: IMAGE_SIZE, height: IMAGE_SIZE},
          ]}
        />
      )}
      <View style={[a.flex_1, a.gap_xs]}>
        <Text emoji style={[a.text_md, a.font_bold]}>
          {event.value.name}
        </Text>
        {startDate && !isNaN(startDate.getTime()) && (
          <Text style={[t.atoms.text_contrast_medium]}>
            {i18n.date(startDate, {dateStyle: 'medium', timeStyle: 'short'})}
          </Text>
        )}
      </View>
    </View>
  )
}
