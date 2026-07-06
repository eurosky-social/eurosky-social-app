import {useState} from 'react'
import {Pressable, View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useCurrentAccountProfile} from '#/state/queries/useCurrentAccountProfile'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Toggle from '#/components/forms/Toggle'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import * as Layout from '#/components/Layout'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {
  NAME_GRADIENTS,
  type NameGradient,
  nameGradientTextStyle,
  useMyDecorationSettings,
  useSetDecorations,
} from '#/features/avatarDecorations'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'DecorationsSettings'
>
export function DecorationsSettingsScreen({}: Props) {
  const {t: l} = useLingui()
  const t = useTheme()
  const profile = useCurrentAccountProfile()
  const saved = useMyDecorationSettings()
  const setDecorations = useSetDecorations()

  // Local edits override the saved values once the user touches anything;
  // before that we follow whatever is saved. `picked` undefined means "None".
  const [picked, setPicked] = useState<string | undefined>(undefined)
  const [outline, setOutline] = useState(false)
  const [touched, setTouched] = useState(false)
  const selectedId = touched ? picked : saved.name
  const selectedOutline = touched ? outline : !!saved.nameOutline
  const selected = NAME_GRADIENTS.find(g => g.id === selectedId)
  const dirty =
    touched && (picked !== saved.name || outline !== !!saved.nameOutline)

  const previewName = sanitizeDisplayName(
    profile?.displayName || sanitizeHandle(profile?.handle || 'you'),
  )

  function choose(id: string | undefined) {
    setPicked(id)
    setOutline(selectedOutline)
    setTouched(true)
  }

  function toggleOutline(value: boolean) {
    setPicked(selectedId)
    setOutline(value)
    setTouched(true)
  }

  function onSave() {
    setDecorations.mutate(
      {name: selectedId, nameOutline: selectedOutline},
      {
        onSuccess: () => {
          setTouched(false)
          Toast.show(l`Saved`)
        },
        onError: () => Toast.show(l`Could not save. Try again.`),
      },
    )
  }

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Profile decorations</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <Text
            style={[
              a.text_sm,
              a.leading_snug,
              t.atoms.text_contrast_medium,
              a.px_lg,
            ]}>
            <Trans>
              Give your display name a gradient. It shows across the app while
              your subscription is active.
            </Trans>
          </Text>

          {/* Live preview of the name with the current selection. */}
          <View
            style={[
              a.mx_lg,
              a.my_md,
              a.p_xl,
              a.rounded_md,
              a.align_center,
              a.justify_center,
              t.atoms.bg_contrast_25,
            ]}>
            <Text
              emoji
              style={[
                a.text_3xl,
                a.font_bold,
                t.atoms.text,
                selected &&
                  nameGradientTextStyle(selected, {outline: selectedOutline}),
              ]}>
              {previewName}
            </Text>
          </View>

          {/* Swatch grid. */}
          <View style={[a.flex_row, a.flex_wrap, a.gap_sm, a.px_lg]}>
            <NoneSwatch
              selected={!selectedId}
              onPress={() => choose(undefined)}
            />
            {NAME_GRADIENTS.map(g => (
              <GradientSwatch
                key={g.id}
                gradient={g}
                selected={selectedId === g.id}
                onPress={() => choose(g.id)}
              />
            ))}
          </View>

          <View style={[a.px_lg, a.pt_lg]}>
            <Toggle.Item
              name="deco_name_outline"
              label={l`Outline`}
              value={selectedOutline}
              disabled={!selectedId}
              onChange={toggleOutline}
              style={[a.w_full]}>
              <Toggle.LabelText style={[a.flex_1]}>
                <Trans>Outline</Trans>
              </Toggle.LabelText>
              <Toggle.Platform />
            </Toggle.Item>
            <Text
              style={[a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>
                Adds a dark edge so the name pops on any background.
              </Trans>
            </Text>
          </View>

          <View style={[a.px_lg, a.pt_xl]}>
            <Button
              label={l`Save`}
              size="large"
              color="primary"
              disabled={!dirty || setDecorations.isPending}
              onPress={onSave}>
              <ButtonText>
                {setDecorations.isPending ? (
                  <Trans>Saving…</Trans>
                ) : (
                  <Trans>Save</Trans>
                )}
              </ButtonText>
            </Button>
          </View>
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}

const SWATCH_HEIGHT = 52

function GradientSwatch({
  gradient,
  selected,
  onPress,
}: {
  gradient: NameGradient
  selected: boolean
  onPress: () => void
}) {
  const t = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={gradient.name}
      accessibilityHint=""
      accessibilityState={{selected}}
      onPress={onPress}
      style={[
        a.rounded_md,
        a.overflow_hidden,
        {height: SWATCH_HEIGHT, flexBasis: '31%', flexGrow: 1},
        selected && {
          borderWidth: 2,
          borderColor: t.atoms.text.color,
        },
      ]}>
      <LinearGradient
        colors={gradient.colors as [string, string, ...string[]]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={[a.absolute, a.inset_0]}
      />
      <View style={[a.flex_1, a.align_center, a.justify_center, a.px_sm]}>
        <Text
          numberOfLines={1}
          style={[
            a.text_sm,
            a.font_bold,
            {
              color: '#FFFFFF',
              textShadowColor: 'rgba(0,0,0,0.35)',
              textShadowRadius: 3,
            },
          ]}>
          {gradient.name}
        </Text>
        {selected && (
          <View
            style={[
              a.absolute,
              a.rounded_full,
              a.align_center,
              a.justify_center,
              {
                top: 4,
                right: 4,
                width: 18,
                height: 18,
                backgroundColor: 'rgba(0,0,0,0.35)',
              },
            ]}>
            <CheckIcon size="xs" fill="#FFFFFF" />
          </View>
        )}
      </View>
    </Pressable>
  )
}

function NoneSwatch({
  selected,
  onPress,
}: {
  selected: boolean
  onPress: () => void
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={l`None`}
      accessibilityHint=""
      accessibilityState={{selected}}
      onPress={onPress}
      style={[
        a.rounded_md,
        a.align_center,
        a.justify_center,
        t.atoms.bg_contrast_25,
        {height: SWATCH_HEIGHT, flexBasis: '31%', flexGrow: 1},
        selected
          ? {borderWidth: 2, borderColor: t.atoms.text.color}
          : {
              borderWidth: 1,
              borderColor: t.atoms.border_contrast_low.borderColor,
            },
      ]}>
      <Text style={[a.text_sm, a.font_bold, t.atoms.text_contrast_medium]}>
        <Trans>None</Trans>
      </Text>
    </Pressable>
  )
}
