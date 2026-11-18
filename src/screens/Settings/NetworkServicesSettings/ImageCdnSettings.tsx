import {useRef, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {useProfileQuery} from '#/state/queries/profile'
import {useAppviewClient, useSession} from '#/state/session'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {FormError} from '#/components/forms/FormError'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {Image_Stroke2_Corner2_Rounded as ImageIcon} from '#/components/icons/Image'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'
import {
  getConfiguredImageCdn,
  getImageCdn,
  getImageCdnOptionId,
  IMAGE_CDN_PRESETS,
  type ImageCdnOptionId,
  ImageCdnValidationError,
  normalizeImageCdnUrl,
  SOURCE_IMAGE_CDN,
} from '#/features/imageCdn/config'
import {getImageCdnPath, verifyImageCdn} from '#/features/imageCdn/verify'
import {app} from '#/lexicons'
import {device, useStorage} from '#/storage'
import {NetworkServicesRestartRequiredPrompt} from './RestartRequiredPrompt'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'ImageCdnSettings'>

/** Sampled when the current account has no avatar to test a CDN with. */
const FALLBACK_SAMPLE_ACTOR = 'bsky.app'

export function ImageCdnSettingsScreen({}: Props) {
  const {t: l} = useLingui()
  const t = useTheme()
  const [, setOverride] = useStorage(device, ['imageCdnOverride'])
  const {currentAccount} = useSession()
  const {data: profile} = useProfileQuery({did: currentAccount?.did})
  const client = useAppviewClient()
  const configured = getConfiguredImageCdn()
  const current = getImageCdn()
  const currentOption = getImageCdnOptionId(current)
  const [selected, setSelected] = useState<ImageCdnOptionId>(currentOption)
  const [customUrl, setCustomUrl] = useState(
    currentOption === 'custom' ? current : '',
  )
  const [error, setError] = useState<string>()
  const [isSaving, setIsSaving] = useState(false)
  const savingRef = useRef(false)
  const restartControl = useDialogControl()

  const presetNames = {
    bluesky: l`Bluesky`,
    porxie: l`Porxie`,
  } as const
  const options: {id: ImageCdnOptionId; url: string; name: string}[] = [
    ...(getImageCdnOptionId(configured) === 'default'
      ? [
          {
            id: 'default' as const,
            url: configured,
            name: new URL(configured).host,
          },
        ]
      : []),
    ...IMAGE_CDN_PRESETS.map(preset => ({
      ...preset,
      name: presetNames[preset.id],
    })),
  ]

  let normalizedCustomUrl = customUrl.trim()
  try {
    normalizedCustomUrl = normalizeImageCdnUrl(customUrl)
  } catch {}
  const hasChanges =
    selected !== currentOption ||
    (selected === 'custom' && normalizedCustomUrl !== current)
  const canSave =
    hasChanges && (selected !== 'custom' || customUrl.trim().length > 0)

  const validationError = (cause: unknown) => {
    if (!(cause instanceof ImageCdnValidationError)) {
      return l`We couldn’t verify this CDN. Check the URL and try again.`
    }
    switch (cause.code) {
      case 'invalid-url':
        return l`Enter a valid URL.`
      case 'https-required':
        return l`The URL must use HTTPS.`
      case 'base-url-required':
        return l`Enter the CDN’s base URL, without a query or fragment.`
      case 'unreachable':
        return l`This CDN didn’t return a test image.`
    }
  }

  const save = async () => {
    /* Keyboard submit does not inherit the button's disabled state. */
    if (!canSave || savingRef.current) return

    savingRef.current = true
    setError(undefined)
    setIsSaving(true)
    try {
      const next =
        selected === 'custom'
          ? normalizeImageCdnUrl(customUrl)
          : options.find(option => option.id === selected)!.url

      /* Every AppView serves the Bluesky CDN, so it needs no test. */
      if (next !== SOURCE_IMAGE_CDN) {
        let samplePath = getImageCdnPath(profile?.avatar)
        if (!samplePath) {
          const fallback = await client.call(app.bsky.actor.getProfile, {
            actor: FALLBACK_SAMPLE_ACTOR,
          })
          samplePath = getImageCdnPath(fallback.avatar)
        }
        if (!samplePath) throw new Error('No sample image to verify with')
        await verifyImageCdn(next, samplePath)
      }

      /* No override means future builds can continue choosing the default. */
      setOverride(next === configured ? undefined : next)
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
            <Trans>Image CDN</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.Group contentContainerStyle={[a.gap_lg]}>
            <SettingsList.ItemIcon icon={ImageIcon} />
            <SettingsList.ItemText>
              <Trans>Image CDN</Trans>
            </SettingsList.ItemText>

            <Text
              style={[
                a.w_full,
                a.text_sm,
                a.leading_snug,
                t.atoms.text_contrast_medium,
              ]}>
              <Trans>
                Choose where avatars, banners, and post images load from. This
                setting applies to every account on this device.
              </Trans>
            </Text>

            <Admonition type="info" style={[a.w_full]}>
              <Trans>
                The CDN you choose can see your IP address and which images you
                load.
              </Trans>
            </Admonition>

            <Toggle.Group
              type="radio"
              label={l`Image CDN`}
              values={[selected]}
              onChange={values => {
                setSelected(values[0] as ImageCdnOptionId)
                setError(undefined)
              }}>
              <View style={[a.gap_lg, a.w_full]}>
                {options.map(option => {
                  const label =
                    option.url === configured
                      ? l`${option.name} (default)`
                      : option.name
                  return (
                    <Toggle.Item
                      key={option.id}
                      name={option.id}
                      label={label}
                      style={[a.flex_row, a.align_start, a.gap_sm, a.w_full]}>
                      <Toggle.Radio />
                      <View style={[a.flex_1, a.gap_2xs]}>
                        <Toggle.LabelText
                          style={[t.atoms.text, a.font_normal, a.text_md]}>
                          {label}
                        </Toggle.LabelText>
                        <Text
                          style={[
                            a.text_sm,
                            a.leading_snug,
                            t.atoms.text_contrast_medium,
                          ]}>
                          {option.url}
                        </Text>
                      </View>
                    </Toggle.Item>
                  )
                })}

                <Toggle.Item
                  name="custom"
                  label={l`Custom image CDN`}
                  style={[a.flex_row, a.align_center, a.gap_sm, a.w_full]}>
                  <Toggle.Radio />
                  <Toggle.LabelText
                    style={[t.atoms.text, a.font_normal, a.text_md]}>
                    <Trans>Custom</Trans>
                  </Toggle.LabelText>
                </Toggle.Item>
              </View>
            </Toggle.Group>

            {selected === 'custom' && (
              <View style={[a.gap_sm, a.w_full]}>
                <TextField.LabelText>
                  <Trans>Custom CDN URL</Trans>
                </TextField.LabelText>
                <TextField.Root isInvalid={!!error}>
                  <TextField.Input
                    label={l`Custom CDN URL`}
                    defaultValue={customUrl}
                    placeholder="https://cdn.example.com"
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
                    Must serve images at the same paths as cdn.bsky.app.
                  </Trans>
                </Text>
              </View>
            )}

            <FormError error={error} />

            <Button
              label={l`Save image CDN`}
              size="large"
              color="primary"
              disabled={isSaving || !canSave}
              onPress={() => void save()}>
              <ButtonText>
                {isSaving ? <Trans>Checking…</Trans> : <Trans>Save</Trans>}
              </ButtonText>
            </Button>
          </SettingsList.Group>
        </SettingsList.Container>
      </Layout.Content>

      <NetworkServicesRestartRequiredPrompt
        control={restartControl}
        description={l`Restart the app to load images from the selected CDN.`}
      />
    </Layout.Screen>
  )
}
