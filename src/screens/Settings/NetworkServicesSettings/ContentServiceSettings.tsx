import {useRef, useState} from 'react'
import {Pressable, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {FormError} from '#/components/forms/FormError'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {CircleInfo_Stroke2_Corner0_Rounded as CircleInfoIcon} from '#/components/icons/CircleInfo'
import {Earth_Stroke2_Corner2_Rounded as EarthIcon} from '#/components/icons/Globe'
import * as Layout from '#/components/Layout'
import * as Tooltip from '#/components/Tooltip'
import {Text} from '#/components/Typography'
import {
  APP_VIEW_PRESETS,
  type AppViewOptionId,
  AppViewValidationError,
  getAppViewOptionId,
  getConfiguredAppView,
  isConfiguredAppView,
  normalizeAppViewUrl,
  resolveCustomAppView,
} from '#/features/appView/config'
import {type AppViewPreference} from '#/features/appView/types'
import {device, useStorage} from '#/storage'
import {NetworkServicesRestartRequiredPrompt} from './RestartRequiredPrompt'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'ContentServiceSettings'
>

export function ContentServiceSettingsScreen({}: Props) {
  const {t: l} = useLingui()
  const t = useTheme()
  const [override, setOverride] = useStorage(device, ['appViewOverride'])
  const configured = getConfiguredAppView()
  const current = override ?? configured
  const currentOption = getAppViewOptionId(current)
  const [selected, setSelected] = useState<AppViewOptionId>(currentOption)
  const [customUrl, setCustomUrl] = useState(
    currentOption === 'custom' ? current.url : '',
  )
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)
  const savingRef = useRef(false)
  const restartControl = useDialogControl()

  const presetNames = {
    bluesky: l`Bluesky`,
    eurosky: l`Eurosky`,
    blacksky: l`Blacksky`,
  } as const

  let normalizedCustomUrl = customUrl.trim()
  try {
    normalizedCustomUrl = normalizeAppViewUrl(customUrl)
  } catch {}
  const hasChanges =
    selected !== currentOption ||
    (selected === 'custom' && normalizedCustomUrl !== current.url)
  const canSave =
    hasChanges && (selected !== 'custom' || customUrl.trim().length > 0)

  const validationError = (cause: unknown) => {
    if (!(cause instanceof AppViewValidationError)) {
      return l`We couldn’t verify this service. Check the URL and try again.`
    }
    switch (cause.code) {
      case 'invalid-url':
        return l`Enter a valid service URL.`
      case 'https-required':
        return l`The service URL must use HTTPS.`
      case 'base-url-required':
        return l`Enter only the service’s base URL, without a path, query, or fragment.`
      case 'did-document-unavailable':
        return l`We couldn’t load this service’s identity information.`
      case 'invalid-did-document':
        return l`This URL doesn’t publish valid matching identity information.`
      case 'missing-appview-service':
        return l`This service isn’t configured as a compatible content service.`
      case 'endpoint-mismatch':
        return l`The registered service endpoint doesn’t match this URL.`
    }
  }

  const save = async () => {
    /* Keyboard submit does not inherit the button's disabled state. */
    if (!canSave || savingRef.current) return

    savingRef.current = true
    setError(undefined)
    setIsSaving(true)
    try {
      let next: AppViewPreference
      if (selected === 'custom') {
        next = await resolveCustomAppView(customUrl)
      } else {
        next = APP_VIEW_PRESETS.find(preset => preset.id === selected)!
      }

      /* No override means future builds can continue choosing the default. */
      setOverride(isConfiguredAppView(next) ? undefined : next)
      restartControl.open()
    } catch (cause) {
      setError(validationError(cause))
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Content service</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.Group contentContainerStyle={[a.gap_lg]}>
            <SettingsList.ItemIcon icon={EarthIcon} />
            <SettingsList.ItemText>
              <Trans>Content service</Trans>
            </SettingsList.ItemText>

            <View style={[a.gap_sm, a.w_full]}>
              <Text
                style={[
                  a.text_sm,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                ]}>
                <Trans>
                  Choose the content service that supplies profiles, posts, and
                  most feeds. This kind of service is sometimes called an
                  AppView. This setting applies to every account on this device.
                </Trans>
              </Text>
              <Text
                style={[
                  a.text_sm,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                ]}>
                <Trans>
                  Only use a content service you trust. Different services may
                  return different content and apply different moderation
                  policies.
                </Trans>
              </Text>
            </View>

            <Toggle.Group
              type="radio"
              label={l`Content service`}
              values={[selected]}
              onChange={values => {
                setSelected(values[0] as AppViewOptionId)
                setError(undefined)
              }}>
              <View style={[a.gap_lg, a.w_full]}>
                {APP_VIEW_PRESETS.map(preset => {
                  const name = presetNames[preset.id]
                  const label = isConfiguredAppView(preset)
                    ? l`${name} (default)`
                    : name
                  return (
                    <View
                      key={preset.id}
                      style={[a.flex_row, a.align_center, a.gap_xs, a.w_full]}>
                      <Toggle.Item
                        name={preset.id}
                        label={label}
                        style={[
                          a.flex_1,
                          a.flex_row,
                          a.align_center,
                          a.gap_sm,
                        ]}>
                        <Toggle.Radio />
                        <Toggle.LabelText
                          style={[t.atoms.text, a.font_normal, a.text_md]}>
                          {label}
                        </Toggle.LabelText>
                      </Toggle.Item>
                      <ServiceAddressInfo name={name} url={preset.url} />
                    </View>
                  )
                })}

                <Toggle.Item
                  name="custom"
                  label={l`Custom content service`}
                  style={[a.flex_row, a.align_start, a.gap_sm, a.w_full]}>
                  <Toggle.Radio />
                  <View style={[a.flex_1, a.gap_2xs]}>
                    <Toggle.LabelText
                      style={[t.atoms.text, a.font_normal, a.text_md]}>
                      <Trans>Custom</Trans>
                    </Toggle.LabelText>
                    <Text
                      style={[
                        a.text_sm,
                        a.leading_snug,
                        t.atoms.text_contrast_medium,
                      ]}>
                      <Trans>Use another compatible content service</Trans>
                    </Text>
                  </View>
                </Toggle.Item>
              </View>
            </Toggle.Group>

            {selected === 'custom' && (
              <View style={[a.gap_sm, a.w_full]}>
                <TextField.LabelText>
                  <Trans>Custom service URL</Trans>
                </TextField.LabelText>
                <TextField.Root isInvalid={!!error}>
                  <TextField.Input
                    label={l`Custom service URL`}
                    defaultValue={customUrl}
                    placeholder="https://api.example.com"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    onChangeText={value => {
                      setCustomUrl(value)
                      setError(undefined)
                    }}
                    onSubmitEditing={() => void save()}
                  />
                </TextField.Root>
                <Text
                  style={[
                    a.text_xs,
                    a.leading_snug,
                    t.atoms.text_contrast_medium,
                  ]}>
                  <Trans>
                    The URL must identify a compatible content service.
                  </Trans>
                </Text>
              </View>
            )}

            <FormError error={error} />

            <Button
              label={l`Save content service`}
              size="large"
              color="primary"
              disabled={isSaving || !canSave}
              onPress={() => void save()}>
              <ButtonText>
                {isSaving ? <Trans>Checking…</Trans> : <Trans>Save</Trans>}
              </ButtonText>
            </Button>

            <Text
              style={[
                a.text_xs,
                a.leading_snug,
                t.atoms.text_contrast_medium,
                a.w_full,
              ]}>
              <Trans>
                Not every content service supports every feature. When needed,
                the app may still use Bluesky for features the selected service
                doesn’t support.
              </Trans>
            </Text>
          </SettingsList.Group>
        </SettingsList.Container>
      </Layout.Content>

      <NetworkServicesRestartRequiredPrompt control={restartControl} />
    </Layout.Screen>
  )
}

function ServiceAddressInfo({name, url}: {name: string; url: string}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const [visible, setVisible] = useState(false)
  const label = l`Show service address for ${name}`

  return (
    <Tooltip.Outer visible={visible} onVisibleChange={setVisible}>
      <Tooltip.Target>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={l`Shows the service address`}
          hitSlop={8}
          onHoverIn={() => setVisible(true)}
          onHoverOut={() => setVisible(false)}
          onPress={() => setVisible(value => !value)}
          style={[a.rounded_full, a.p_xs]}>
          <CircleInfoIcon size="sm" fill={t.atoms.text_contrast_medium.color} />
        </Pressable>
      </Tooltip.Target>
      <Tooltip.BubbleText label={label}>{url}</Tooltip.BubbleText>
    </Tooltip.Outer>
  )
}
