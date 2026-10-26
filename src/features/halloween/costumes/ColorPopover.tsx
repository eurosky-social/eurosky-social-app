import {useState} from 'react'
import {Pressable, ScrollView, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {TimesLarge_Stroke2_Corner0_Rounded as CloseIcon} from '#/components/icons/Times'
import {Text} from '#/components/Typography'
import {ColorPicker} from '#/features/halloween/costumes/ColorPicker'
import {DEFAULT_PALETTE} from '#/features/halloween/costumes/model'

type PanelProps = {
  width: number
  maxHeight: number
  onClose: () => void
}

export function ColorPopover({
  color,
  recent,
  onChange,
  width,
  maxHeight,
  onClose,
}: PanelProps & {
  color: string
  recent: string[]
  onChange: (color: string) => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const [tab, setTab] = useState<'presets' | 'custom' | 'recent'>('presets')
  /** Web scroll refs lack setNativeProps; scrollEnabled works on both platforms. */
  const [interacting, setInteracting] = useState(false)
  const tabs = [
    {id: 'presets', label: l`Presets`, hint: l`Preset colors`},
    {id: 'custom', label: l`Custom`, hint: l`Custom colors`},
    {id: 'recent', label: l`Recent`, hint: l`Recently used colors`},
  ] as const
  return (
    <View
      testID="costumeColorPopover"
      accessibilityViewIsModal
      style={[
        a.p_md,
        a.gap_sm,
        a.rounded_md,
        a.border,
        t.atoms.bg,
        t.atoms.border_contrast_low,
        {width, maxHeight},
      ]}>
      <PanelHeader
        title={l`Color`}
        onClose={onClose}
        testID="costumeColorPickerClose"
      />
      <View accessibilityRole="tablist" style={[a.flex_row, a.gap_xs]}>
        {tabs.map(item => (
          <Button
            key={item.id}
            testID={`costumeColorTab-${item.id}`}
            label={item.hint}
            accessibilityRole="tab"
            accessibilityState={{selected: tab === item.id}}
            size="small"
            color={tab === item.id ? 'primary_subtle' : 'secondary'}
            style={[a.flex_1, {minHeight: 44}]}
            onPress={() => {
              setInteracting(false)
              setTab(item.id)
            }}>
            <ButtonText style={[a.text_xs]}>{item.label}</ButtonText>
          </Button>
        ))}
      </View>
      <ScrollView
        testID="costumeColorScroll"
        scrollEnabled={!interacting}
        style={{maxHeight: Math.max(64, maxHeight - 112), flexShrink: 1}}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[a.pb_xs]}>
        {tab === 'custom' ? (
          <ColorPicker
            color={color}
            width={width - 24}
            maxHeight={maxHeight - 112}
            onChange={onChange}
            onInteractionChange={setInteracting}
          />
        ) : (
          <View style={[a.flex_row, a.flex_wrap, a.gap_xs, a.justify_center]}>
            {(tab === 'presets' ? DEFAULT_PALETTE : recent).map(
              (swatch, index) => (
                <Pressable
                  key={swatch}
                  testID={`costume${tab === 'presets' ? 'Preset' : 'Recent'}Color-${index}`}
                  accessibilityRole="radio"
                  accessibilityLabel={l`Color ${swatch}`}
                  accessibilityHint={l`Select drawing color`}
                  accessibilityState={{checked: swatch === color}}
                  onPress={() => {
                    onChange(swatch)
                    onClose()
                  }}
                  style={[
                    a.rounded_full,
                    a.align_center,
                    a.justify_center,
                    {
                      width: 44,
                      height: 44,
                      borderWidth: 2,
                      borderColor:
                        swatch === color
                          ? t.palette.primary_500
                          : 'transparent',
                    },
                  ]}>
                  <View
                    style={[
                      a.rounded_full,
                      {
                        width: 30,
                        height: 30,
                        backgroundColor: swatch,
                        borderWidth: 1,
                        borderColor: t.palette.contrast_300,
                      },
                    ]}
                  />
                </Pressable>
              ),
            )}
            {tab === 'recent' && !recent.length && (
              <Text style={[a.p_lg, a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>Paint a color to add it here.</Trans>
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

export function BrushSizePopover({
  size,
  onChange,
  width,
  maxHeight,
  onClose,
}: PanelProps & {size: number; onChange: (size: number) => void}) {
  const {t: l} = useLingui()
  const t = useTheme()
  return (
    <View
      testID="costumeBrushPopover"
      accessibilityViewIsModal
      style={[
        a.p_md,
        a.gap_sm,
        a.rounded_md,
        a.border,
        t.atoms.bg,
        t.atoms.border_contrast_low,
        {width, maxHeight},
      ]}>
      <PanelHeader
        title={l`Brush size`}
        onClose={onClose}
        testID="costumeBrushPickerClose"
      />
      <ScrollView
        style={{maxHeight: Math.max(64, maxHeight - 64)}}
        contentContainerStyle={[
          a.flex_row,
          a.flex_wrap,
          a.justify_center,
          a.gap_xs,
        ]}>
        {[1, 2, 4, 8, 12, 16].map(value => (
          <Button
            key={value}
            testID={`costumeBrushSize-${value}`}
            label={l`Brush size: ${value} pixels`}
            size="small"
            shape="square"
            color={size === value ? 'primary_subtle' : 'secondary'}
            accessibilityState={{selected: size === value}}
            style={{width: 44, height: 52}}
            onPress={() => {
              onChange(value)
              onClose()
            }}>
            <View style={[a.align_center, a.gap_xs]}>
              <View
                style={[
                  a.rounded_full,
                  {
                    width: Math.min(24, value * 2 + 2),
                    height: Math.min(24, value * 2 + 2),
                    backgroundColor: t.palette.contrast_700,
                  },
                ]}
              />
              <Text style={[a.text_xs]}>{value}</Text>
            </View>
          </Button>
        ))}
      </ScrollView>
    </View>
  )
}

function PanelHeader({
  title,
  testID,
  onClose,
}: {
  title: string
  testID: string
  onClose: () => void
}) {
  const {t: l} = useLingui()
  return (
    <View style={[a.flex_row, a.align_center, a.justify_between]}>
      <Text style={[a.font_bold]}>{title}</Text>
      <Button
        testID={testID}
        label={l`Close tool options`}
        size="small"
        shape="round"
        color="secondary"
        onPress={onClose}>
        <ButtonIcon icon={CloseIcon} />
      </Button>
    </View>
  )
}
