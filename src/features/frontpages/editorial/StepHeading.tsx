import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {ArrowLeft_Stroke2_Corner0_Rounded as BackIcon} from '#/components/icons/Arrow'
import {Text} from '#/components/Typography'

/**
 * A dialog step's heading. On a component's own step it names the component
 * chosen, and the way back says it returns to the choice of components.
 */
export function StepHeading({
  title,
  kind,
  onBack,
}: {
  title: string
  /** The component this step is for, when one was chosen: Post, Featured feeds. */
  kind?: string
  /** Returns to choosing a component; absent on the choice itself, or when editing. */
  onBack?: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View style={[a.gap_sm]}>
      {onBack && (
        <View style={[a.flex_row]}>
          <Button
            testID="slotDialogBack"
            label={l`Change component: back to the choice of what fills the slot`}
            size="small"
            variant="ghost"
            color="secondary"
            onPress={onBack}>
            <ButtonIcon icon={BackIcon} />
            <ButtonText>
              <Trans>Change component</Trans>
            </ButtonText>
          </Button>
        </View>
      )}
      <View style={[a.gap_2xs]}>
        {!!kind && (
          <Text
            testID="slotDialogKind"
            style={[
              a.text_xs,
              a.font_semi_bold,
              t.atoms.text_contrast_medium,
              {textTransform: 'uppercase', letterSpacing: 0.6},
            ]}>
            {kind}
          </Text>
        )}
        <Text style={[a.text_2xl, a.font_bold]}>{title}</Text>
      </View>
    </View>
  )
}
