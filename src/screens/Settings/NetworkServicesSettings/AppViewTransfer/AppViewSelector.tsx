import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a} from '#/alf'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import {Text} from '#/components/Typography'
import {APP_VIEW_PRESETS, type AppViewOptionId} from '#/features/appView/config'

export type AppViewSelectorValue = {
  option: AppViewOptionId
  customUrl: string
}

export function AppViewSelector({
  titleText,
  label,
  value,
  onChange,
}: {
  titleText: React.ReactNode
  label: string
  value: AppViewSelectorValue
  onChange: (value: AppViewSelectorValue) => void
}) {
  const {t: l} = useLingui()
  const presetNames = {
    bluesky: l`Bluesky`,
    eurosky: l`Eurosky`,
    blacksky: l`Blacksky`,
  } as const

  return (
    <View style={[a.gap_sm, a.w_full]}>
      <Text style={[a.text_sm, a.font_semi_bold]}>{titleText}</Text>
      <SegmentedControl.Root<AppViewOptionId>
        type="radio"
        size="small"
        label={label}
        value={value.option}
        onChange={option => onChange({...value, option})}>
        {APP_VIEW_PRESETS.map(preset => {
          const name = presetNames[preset.id]
          return (
            <SegmentedControl.Item
              key={preset.id}
              value={preset.id}
              label={name}>
              <SegmentedControl.ItemText numberOfLines={1}>
                {name}
              </SegmentedControl.ItemText>
            </SegmentedControl.Item>
          )
        })}
        <SegmentedControl.Item value="custom" label={l`Custom content service`}>
          <SegmentedControl.ItemText numberOfLines={1}>
            <Trans>Custom</Trans>
          </SegmentedControl.ItemText>
        </SegmentedControl.Item>
      </SegmentedControl.Root>

      {value.option === 'custom' && (
        <View style={[a.gap_sm, a.w_full]}>
          <TextField.LabelText>
            <Trans>Custom service URL</Trans>
          </TextField.LabelText>
          <TextField.Root>
            <TextField.Input
              label={l`Custom service URL`}
              defaultValue={value.customUrl}
              placeholder="https://api.example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onChangeText={customUrl => onChange({...value, customUrl})}
            />
          </TextField.Root>
        </View>
      )}
    </View>
  )
}
