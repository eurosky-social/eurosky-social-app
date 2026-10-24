import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import * as Toggle from '#/components/forms/Toggle'
import {Sparkle_Stroke2_Corner0_Rounded as SparkleIcon} from '#/components/icons/Sparkle'
import {Text} from '#/components/Typography'
import {useHalloween} from '#/features/halloween/context'

export function HalloweenAppearanceSettings() {
  const {t: l} = useLingui()
  const t = useTheme()
  const {enabled, isActive, setEnabled} = useHalloween()

  return (
    <>
      <SettingsList.Divider />
      <SettingsList.Group contentContainerStyle={[a.gap_sm]} iconInset={false}>
        <SettingsList.ItemIcon icon={SparkleIcon} />
        <SettingsList.ItemText>
          <Trans>Halloween theme</Trans>
        </SettingsList.ItemText>
        <Toggle.Item
          testID="halloweenModeToggle"
          name="halloween_mode"
          label={l`Halloween theme`}
          value={enabled}
          onChange={setEnabled}
          style={[a.w_full]}>
          <Toggle.LabelText style={[a.flex_1]}>
            <Trans>Halloween theme</Trans>
          </Toggle.LabelText>
          <Toggle.Platform />
        </Toggle.Item>
        <View style={[a.w_full, a.gap_sm]}>
          <Text
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            <Trans>
              Use dark mode with orange accents each October 28–November 3, in
              your local time. Your regular appearance returns on November 4.
              This device-only setting does not affect costumes or candy.
            </Trans>
          </Text>
          {isActive && (
            <Text
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>
                The Halloween theme is active. Turn it off to use your saved
                color mode and accent color.
              </Trans>
            </Text>
          )}
        </View>
      </SettingsList.Group>
    </>
  )
}
