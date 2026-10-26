import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Toggle from '#/components/forms/Toggle'
import {Key_Stroke2_Corner2_Rounded as KeyIcon} from '#/components/icons/Key'
import {Text} from '#/components/Typography'
import {emitOpenKeyboardShortcuts} from './events'
import {useKeyboardShortcutsPreference} from './preferences'

export function KeyboardShortcutsSettings() {
  const {t: l} = useLingui()
  const t = useTheme()
  const {enabled, setEnabled} = useKeyboardShortcutsPreference()

  return (
    <>
      <SettingsList.Divider />
      <SettingsList.Group contentContainerStyle={[a.gap_sm]}>
        <SettingsList.ItemIcon icon={KeyIcon} />
        <SettingsList.ItemText>
          <Trans>Keyboard shortcuts</Trans>
        </SettingsList.ItemText>
        <Toggle.Item
          name="keyboard_shortcuts"
          label={l`Enable keyboard shortcuts`}
          value={enabled}
          onChange={setEnabled}
          style={[a.w_full]}>
          <View style={[a.flex_1, a.gap_2xs]}>
            <Toggle.LabelText>
              <Trans>Enable keyboard shortcuts</Trans>
            </Toggle.LabelText>
            <Text
              style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>
                Use single keys to navigate and interact with posts on the web.
              </Trans>
            </Text>
          </View>
          <Toggle.Platform />
        </Toggle.Item>
        <Button
          label={l`View keyboard shortcuts`}
          size="small"
          color="secondary"
          onPress={emitOpenKeyboardShortcuts}
          style={[a.self_start]}>
          <ButtonText>
            <Trans>View shortcuts</Trans>
          </ButtonText>
        </Button>
      </SettingsList.Group>
    </>
  )
}
