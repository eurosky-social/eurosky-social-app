import {useEffect, useState} from 'react'
import {Pressable, View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'
import {useQueryClient} from '@tanstack/react-query'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {useCurrentAccountProfile} from '#/state/queries/useCurrentAccountProfile'
import {useSession} from '#/state/session'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Toggle from '#/components/forms/Toggle'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {Sparkle_Stroke2_Corner0_Rounded as SparkleIcon} from '#/components/icons/Sparkle'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {BRAND} from '#/config/brand'
import {IS_NATIVE, IS_WEB} from '#/env'
import {
  createDecorationsQueryKey,
  NAME_GRADIENTS,
  type NameGradient,
  nameGradientTextStyle,
  useCancelDecorationSubscriptionMutation,
  useCreateDecorationCheckoutMutation,
  useDecorationSubscriptionQuery,
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
          <SubscriptionSection />
          <SettingsList.Divider />
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

function SubscriptionSection() {
  const {i18n, t: l} = useLingui()
  const t = useTheme()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()
  const cancelPrompt = Prompt.usePromptControl()
  const [awaitingActivation, setAwaitingActivation] = useState(
    () =>
      IS_WEB &&
      new URL(window.location.href).searchParams.get('checkout') === 'return',
  )
  const subscription = useDecorationSubscriptionQuery({
    pollUntilActive: awaitingActivation,
  })
  const createCheckout = useCreateDecorationCheckoutMutation()
  const cancelSubscription = useCancelDecorationSubscriptionMutation()
  const status = subscription.data

  useEffect(() => {
    if (!awaitingActivation || status?.active) return
    const timeout = setTimeout(() => {
      setAwaitingActivation(false)
      Toast.show(l`Payment is still processing. Check again shortly.`)
    }, 60_000)
    return () => clearTimeout(timeout)
  }, [awaitingActivation, l, status?.active])

  useEffect(() => {
    if (!awaitingActivation || !status?.active) return
    if (IS_WEB) {
      const url = new URL(window.location.href)
      url.searchParams.delete('checkout')
      window.history.replaceState({}, '', url.toString())
    }
    Toast.show(l`Your subscription is active`)

    if (currentAccount) {
      const queryKey = createDecorationsQueryKey(currentAccount.did)
      void queryClient.invalidateQueries({queryKey})
      // Constellation needs a moment to index the new list item.
      setTimeout(() => void queryClient.invalidateQueries({queryKey}), 8_000)
      setTimeout(() => void queryClient.invalidateQueries({queryKey}), 30_000)
    }
  }, [awaitingActivation, currentAccount, l, queryClient, status?.active])

  function onSubscribe() {
    createCheckout.mutate(undefined, {
      onSuccess: ({checkoutUrl}) => {
        if (IS_WEB) window.location.assign(checkoutUrl)
      },
      onError: () => Toast.show(l`Could not start checkout. Try again.`),
    })
  }

  function onCancel() {
    cancelSubscription.mutate(undefined, {
      onSuccess: () => Toast.show(l`Your subscription will not renew`),
      onError: () => Toast.show(l`Could not cancel. Try again.`),
    })
  }

  const paidUntil = status?.paidUntil
    ? i18n.date(new Date(status.paidUntil), {dateStyle: 'medium'})
    : undefined
  const price = status
    ? i18n.number(Number(status.plan.amount), {
        style: 'currency',
        currency: status.plan.currency,
      })
    : undefined

  return (
    <SettingsList.Group contentContainerStyle={[a.gap_md]}>
      <View style={[a.flex_row, a.align_center, a.gap_sm, a.w_full]}>
        <SettingsList.ItemIcon icon={SparkleIcon} />
        <View style={[a.flex_1, a.gap_xs]}>
          <Text style={[a.text_md, a.font_bold, t.atoms.text]}>Eurosky+</Text>
          {status?.active ? (
            <Text style={[a.text_sm, {color: t.palette.positive_700}]}>
              <Trans>Subscription active</Trans>
            </Text>
          ) : (
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>Unlock profile decorations</Trans>
            </Text>
          )}
        </View>
      </View>

      {subscription.isPending ? (
        <View style={[a.py_md, a.align_center]}>
          <Loader />
        </View>
      ) : subscription.isError && !status ? (
        <View style={[a.gap_sm, a.w_full]}>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>Could not load your subscription status.</Trans>
          </Text>
          <Button
            label={l`Try again`}
            color="secondary"
            size="small"
            onPress={() => void subscription.refetch()}>
            <ButtonText>
              <Trans>Try again</Trans>
            </ButtonText>
          </Button>
        </View>
      ) : (
        <View style={[a.gap_md, a.w_full]}>
          {awaitingActivation && !status?.active ? (
            <View style={[a.flex_row, a.align_center, a.gap_sm]}>
              <Loader />
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>Confirming your payment…</Trans>
              </Text>
            </View>
          ) : status?.active ? (
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {status.cancelAtPeriodEnd && paidUntil ? (
                <Trans>Your subscription ends on {paidUntil}.</Trans>
              ) : paidUntil ? (
                <Trans>Your next billing date is {paidUntil}.</Trans>
              ) : (
                <Trans>Your decorations are active.</Trans>
              )}
            </Text>
          ) : (
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {status && price && status.plan.billingMonths === 1 ? (
                <Trans>{price} per month. Cancel anytime.</Trans>
              ) : status && price ? (
                <Trans>
                  {price} every {status.plan.billingMonths} months. Cancel
                  anytime.
                </Trans>
              ) : (
                <Trans>Subscribe to use profile decorations.</Trans>
              )}
            </Text>
          )}

          {IS_NATIVE ? (
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>
                To subscribe or manage your subscription, open{' '}
                {BRAND.decorations.manageUrl} in a web browser.
              </Trans>
            </Text>
          ) : status?.active ? (
            !status.cancelAtPeriodEnd && (
              <Button
                label={l`Cancel subscription`}
                color="secondary"
                size="small"
                disabled={cancelSubscription.isPending}
                onPress={() => cancelPrompt.open()}>
                <ButtonText>
                  {cancelSubscription.isPending ? (
                    <Trans>Canceling…</Trans>
                  ) : (
                    <Trans>Cancel subscription</Trans>
                  )}
                </ButtonText>
              </Button>
            )
          ) : (
            <Button
              label={l`Subscribe to Eurosky+`}
              color="primary"
              size="large"
              disabled={createCheckout.isPending || awaitingActivation}
              onPress={onSubscribe}>
              <ButtonText>
                {createCheckout.isPending ? (
                  <Trans>Opening checkout…</Trans>
                ) : (
                  <Trans>Subscribe</Trans>
                )}
              </ButtonText>
            </Button>
          )}
        </View>
      )}

      <Prompt.Basic
        control={cancelPrompt}
        title={l`Cancel subscription?`}
        description={l`Your decorations will remain active until the end of your paid period.`}
        onConfirm={onCancel}
        confirmButtonCta={l`Cancel subscription`}
        confirmButtonColor="negative"
      />
    </SettingsList.Group>
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
