import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Play_Filled_Corner0_Rounded as PlayIcon} from '#/components/icons/Play'
import {TimesLarge_Stroke2_Corner0_Rounded as XIcon} from '#/components/icons/Times'
import {Text} from '#/components/Typography'
import {
  type ComposerMediaTimeState,
  MEDIA_TIME_NUDGE_SECONDS,
} from '../composer'
import {formatMediaTime} from '../record'

/**
 * Shown in the composer when a reply is linked to a second of the video:
 * the time, buttons to move it, and a way to unlink the reply.
 */
export function ComposerMediaTime({state}: {state: ComposerMediaTimeState}) {
  const t = useTheme()
  const {t: l} = useLingui()

  if (!state.available) return null

  if (!state.attached) {
    const time = formatMediaTime(state.seconds)
    return (
      <View
        testID="composerMediaTime"
        style={[a.flex_row, a.align_center, a.gap_sm, a.mx_lg, a.mb_md]}>
        <Text style={[a.flex_1, a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>This reply is about the whole video.</Trans>
        </Text>
        <Button
          testID="composerMediaTimeReattach"
          label={l`Link the reply to ${time} again`}
          size="small"
          color="secondary"
          onPress={state.reattach}>
          <ButtonText>
            <Trans>Link to {time}</Trans>
          </ButtonText>
        </Button>
      </View>
    )
  }

  const time = formatMediaTime(state.seconds)
  return (
    <View
      testID="composerMediaTime"
      style={[
        a.flex_row,
        a.align_center,
        a.gap_xs,
        a.mx_lg,
        a.mb_md,
        a.p_sm,
        a.rounded_md,
        t.atoms.bg_contrast_25,
      ]}>
      <PlayIcon size="xs" style={[t.atoms.text_contrast_medium]} />
      <Text
        style={[a.flex_1, a.text_sm, a.font_semi_bold]}
        accessibilityLiveRegion="polite">
        <Trans>Linked to {time} in the video</Trans>
      </Text>
      <Button
        testID="composerMediaTimeEarlier"
        label={l`${MEDIA_TIME_NUDGE_SECONDS} seconds earlier`}
        size="small"
        color="secondary"
        disabled={state.seconds === 0}
        onPress={() => state.nudge(-MEDIA_TIME_NUDGE_SECONDS)}>
        <ButtonText>
          <Trans comment="Moves a time link 5 seconds earlier">
            −{MEDIA_TIME_NUDGE_SECONDS} s
          </Trans>
        </ButtonText>
      </Button>
      <Button
        testID="composerMediaTimeLater"
        label={l`${MEDIA_TIME_NUDGE_SECONDS} seconds later`}
        size="small"
        color="secondary"
        onPress={() => state.nudge(MEDIA_TIME_NUDGE_SECONDS)}>
        <ButtonText>
          <Trans comment="Moves a time link 5 seconds later">
            +{MEDIA_TIME_NUDGE_SECONDS} s
          </Trans>
        </ButtonText>
      </Button>
      <Button
        testID="composerMediaTimeRemove"
        label={l`Make this a reply to the whole video`}
        size="small"
        color="secondary"
        shape="round"
        onPress={state.detach}>
        <ButtonIcon icon={XIcon} />
      </Button>
    </View>
  )
}
