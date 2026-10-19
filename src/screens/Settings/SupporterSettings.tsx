import {useEffect, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'
import {useQueryClient} from '@tanstack/react-query'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {useSession} from '#/state/session'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Heart2_Filled_Stroke2_Corner0_Rounded as HeartIcon} from '#/components/icons/Heart2'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import * as Prompt from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {BRAND} from '#/config/brand'
import {IS_NATIVE, IS_WEB} from '#/env'
import {
  createSupporterQueryKey,
  SupporterSubscriptionError,
  useCancelSupporterSubscriptionMutation,
  useCreateSupporterCheckoutMutation,
  useSupporterSubscriptionQuery,
} from '#/features/supporter'

const appName = BRAND.name

function clearCheckoutReturn() {
  if (!IS_WEB) return
  const url = new URL(window.location.href)
  url.searchParams.delete('checkout')
  window.history.replaceState(window.history.state, '', url.toString())
}

export function SupporterSettingsScreen({}: NativeStackScreenProps<
  CommonNavigatorParams,
  'SupporterSettings'
>) {
  const {t: l} = useLingui()
  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>{l`Support ${appName}`}</Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SubscriptionSection />
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
  const did = currentAccount?.did
  const cancelPrompt = Prompt.usePromptControl()
  const [awaitingActivation, setAwaitingActivation] = useState(
    () =>
      IS_WEB &&
      new URL(window.location.href).searchParams.get('checkout') === 'return',
  )
  const subscription = useSupporterSubscriptionQuery({
    pollUntilActive: awaitingActivation,
  })
  const createCheckout = useCreateSupporterCheckoutMutation()
  const cancelSubscription = useCancelSupporterSubscriptionMutation()
  const status = subscription.data

  useEffect(() => {
    if (!awaitingActivation) return
    if (status?.active) {
      clearCheckoutReturn()
      setAwaitingActivation(false)
      Toast.show(l`Thank you for supporting ${appName}!`)
      return
    }
    const timeout = setTimeout(() => {
      clearCheckoutReturn()
      setAwaitingActivation(false)
      Toast.show(l`Payment is still processing. Check again shortly.`)
    }, 60_000)
    return () => clearTimeout(timeout)
  }, [awaitingActivation, l, status?.active])

  useEffect(() => {
    if (!status?.active || !did) return
    const queryKey = createSupporterQueryKey(did)
    void queryClient.invalidateQueries({queryKey})
    // Constellation needs a moment to index the new list item.
    const timers = [8_000, 30_000].map(delay =>
      setTimeout(() => void queryClient.invalidateQueries({queryKey}), delay),
    )
    return () => timers.forEach(clearTimeout)
  }, [did, queryClient, status?.active])

  function onSubscribe() {
    createCheckout.mutate(undefined, {
      onSuccess: ({checkoutUrl}) => {
        if (IS_WEB) window.location.assign(checkoutUrl)
      },
      onError: error => {
        if (
          error instanceof SupporterSubscriptionError &&
          (error.code === 'PaymentProcessing' ||
            error.code === 'SubscriptionActive')
        ) {
          setAwaitingActivation(true)
          void subscription.refetch()
        } else {
          Toast.show(l`Could not start checkout. Try again.`)
        }
      },
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
        <HeartIcon width={24} fill={t.palette.pink} />
        <Text style={[a.text_md, a.font_bold]}>{l`${appName} supporter`}</Text>
      </View>
      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>
          Help support {appName} and get a small heart badge beside your name.
          The badge shows your support, not identity verification.
        </Trans>
      </Text>
      <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>Supporter membership is public on the AT Protocol.</Trans>
      </Text>

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
                <Trans>Your supporter subscription is active.</Trans>
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
                <Trans>Become a supporter.</Trans>
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
              testID="supporterSubscribeButton"
              label={l`Support ${appName}`}
              color="primary"
              size="large"
              disabled={createCheckout.isPending || awaitingActivation}
              onPress={onSubscribe}>
              <ButtonText>
                {createCheckout.isPending ? (
                  <Trans>Opening checkout…</Trans>
                ) : (
                  <Trans>Become a supporter</Trans>
                )}
              </ButtonText>
            </Button>
          )}
        </View>
      )}

      <Prompt.Basic
        control={cancelPrompt}
        title={l`Cancel subscription?`}
        description={l`Your supporter badge will remain through your paid period and any grace period.`}
        onConfirm={onCancel}
        confirmButtonCta={l`Cancel subscription`}
        confirmButtonColor="negative"
      />
    </SettingsList.Group>
  )
}
