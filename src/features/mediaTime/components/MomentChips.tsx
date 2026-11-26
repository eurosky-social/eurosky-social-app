import {Pressable, ScrollView, View} from 'react-native'
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
 * are. Tapping one opens it (`onPressMoment`).
 */
export function MomentChips({
  moments,
  onPressMoment,
  onPressAll,
  title,
}: {
  moments: Moment[]
  onPressMoment: (moment: Moment) => void
  /** Shows "All moments", which calls this. */
  onPressAll?: () => void
  /** Defaults to "Moments in this video". */
  title?: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()

  if (moments.length === 0) return null

  return (
    <View testID="mediaTimeMoments" style={[a.gap_xs]}>
      <View style={[a.flex_row, a.align_center, a.justify_between]}>
        <Text
          style={[a.text_xs, a.font_semi_bold, t.atoms.text_contrast_medium]}>
          {title ?? l`Moments in this video`}
        </Text>
        {onPressAll ? (
          <Pressable
            testID="mediaTimeAllMoments"
            accessibilityRole="button"
            accessibilityLabel={l`All moments`}
            accessibilityHint={l`Opens the video with all its moments`}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            onPress={onPressAll}>
            <Text
              style={[
                a.text_xs,
                a.font_semi_bold,
                {color: t.palette.primary_600},
              ]}>
              <Trans>All moments</Trans>
            </Text>
          </Pressable>
        ) : null}
      </View>
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
              key={`${moment.startSeconds}-${moment.endSeconds}`}
              testID={`mediaTimeMoment-${moment.startSeconds}`}
              label={l`Moment at ${time}, ${countLabel}`}
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
