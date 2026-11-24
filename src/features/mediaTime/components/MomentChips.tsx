import {ScrollView, View} from 'react-native'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Play_Filled_Corner0_Rounded as PlayIcon} from '#/components/icons/Play'
import {Text} from '#/components/Typography'
import {type Moment} from '../moments'
import {formatMediaTime} from '../record'

/**
 * A row of moments in a video: where comments bunch up, with how many there
 * are. Tapping one plays the video from there.
 */
export function MomentChips({
  moments,
  onPressMoment,
}: {
  moments: Moment[]
  onPressMoment: (moment: Moment) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  if (moments.length === 0) return null

  return (
    <View testID="mediaTimeMoments" style={[a.gap_xs]}>
      <Text style={[a.text_xs, a.font_semi_bold, t.atoms.text_contrast_medium]}>
        <Trans>Moments in this video</Trans>
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[a.gap_sm]}>
        {moments.map(moment => {
          const time = formatMediaTime(moment.startSeconds)
          const count = moment.count
          const countLabel = plural(count, {
            one: '# comment',
            other: '# comments',
          })
          return (
            <Button
              key={`${moment.startSeconds}-${moment.comments[0].uri}`}
              testID={`mediaTimeMoment-${moment.startSeconds}`}
              label={l`Play from ${time}, ${countLabel}`}
              size="small"
              color="primary_subtle"
              onPress={() => onPressMoment(moment)}>
              <ButtonIcon icon={PlayIcon} />
              <ButtonText>
                <Trans comment="A moment in a video: its time and how many comments it has, e.g. 0:41 · 3">
                  {time} · {count}
                </Trans>
              </ButtonText>
            </Button>
          )
        })}
      </ScrollView>
    </View>
  )
}
