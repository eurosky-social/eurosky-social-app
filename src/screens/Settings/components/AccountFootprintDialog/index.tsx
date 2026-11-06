import {useEffect, useState} from 'react'
import {Pressable, ScrollView, useWindowDimensions, View} from 'react-native'
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import {LinearGradient} from 'expo-linear-gradient'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'

import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {atoms as a, useTheme, utils, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {SquareArrowTopRight_Stroke2_Corner0_Rounded as ExternalIcon} from '#/components/icons/SquareArrowTopRight'
import {Text} from '#/components/Typography'
import {type AccountAction} from '../AccountActionWarning'
import {getRecordLabel} from './labels'
import {type ServiceFootprint} from './services'
import {
  useAccountBlobCountQuery,
  useAccountFootprintQuery,
} from './useAccountFootprintQuery'
import {usePdsAccountLink} from './usePdsAccountLink'

/** Upper bound on the records list, so the actions stay in view. */
const RECORDS_MAX_HEIGHT = 360

/**
 * Account footprint - lists every service with data in the account's repo,
 * with a record count for each, so deleting or deactivating the account isn't
 * mistaken for leaving just this app.
 */
export function AccountFootprintDialog({
  control,
  action,
  useHostingProvider,
  onConfirm,
}: {
  control: Dialog.DialogControlProps
  action: AccountAction
  /**
   * OAuth sessions can't delete or deactivate the account here, so the action
   * button links to the hosting provider instead.
   */
  useHostingProvider: boolean
  /** Runs after this dialog closes, to continue the password flow. */
  onConfirm: () => void
}) {
  return (
    <Dialog.Outer control={control} nativeOptions={{preventExpansion: true}}>
      <Dialog.Handle />
      <Inner
        action={action}
        useHostingProvider={useHostingProvider}
        onConfirm={onConfirm}
      />
    </Dialog.Outer>
  )
}

function Inner({
  action,
  useHostingProvider,
  onConfirm,
}: {
  action: AccountAction
  useHostingProvider: boolean
  onConfirm: () => void
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const control = Dialog.useDialogContext()
  const openLink = useOpenLink()
  const pdsAccountLink = usePdsAccountLink()
  const {height: windowHeight} = useWindowDimensions()
  const {data, isLoading, isError, refetch} = useAccountFootprintQuery()
  const {data: blobCount, isError: isBlobCountError} =
    useAccountBlobCountQuery()

  const formatCount = (count: number) => i18n.number(count)
  const formatRecordCount = (count: number) =>
    data?.counted ? formatCount(count) : ''

  const recordsMaxHeight = Math.min(RECORDS_MAX_HEIGHT, windowHeight * 0.45)
  const [hasMoreAbove, setHasMoreAbove] = useState(false)
  const [hasMoreBelow, setHasMoreBelow] = useState(false)
  const shadowColor = utils.alpha('#000000', t.name === 'light' ? 0.08 : 0.35)
  const clearColor = utils.alpha('#000000', 0)

  return (
    <Dialog.ScrollableInner
      label={
        action === 'delete' ? l`What will be deleted` : l`What will be hidden`
      }
      style={web({maxWidth: 500})}>
      <View style={[a.gap_sm, a.pb_lg]}>
        <Text style={[a.text_2xl, a.font_bold]}>
          {action === 'delete' ? (
            <Trans>What will be deleted</Trans>
          ) : (
            <Trans>What will be hidden</Trans>
          )}
        </Text>
        <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
          {action === 'delete' ? (
            <Trans>
              Your Atmosphere account holds data for every app you’ve used with
              it. Deleting it permanently removes all of this.
            </Trans>
          ) : (
            <Trans>
              Your Atmosphere account holds data for every app you’ve used with
              it. Deactivating hides all of this in every app until you sign
              back in. Nothing is deleted.
            </Trans>
          )}
        </Text>
      </View>

      {isLoading ? (
        <View style={[a.gap_sm, a.py_lg]}>
          <Text style={[t.atoms.text_contrast_medium]}>
            <Trans>Loading your account data…</Trans>
          </Text>
          <LoadingBar />
        </View>
      ) : isError ? (
        <View style={[a.gap_md]}>
          <Admonition type="error">
            <Trans>We couldn’t load your account data. Please try again.</Trans>
          </Admonition>
          <Button
            label={l`Try again`}
            size="small"
            color="secondary"
            onPress={() => void refetch()}>
            <ButtonText>
              <Trans>Try again</Trans>
            </ButtonText>
          </Button>
        </View>
      ) : data && (data.services.length > 0 || !!blobCount) ? (
        <View
          style={[
            a.relative,
            a.rounded_md,
            a.overflow_hidden,
            t.atoms.bg_contrast_25,
          ]}>
          <ScrollView
            nestedScrollEnabled
            scrollEventThrottle={32}
            onScroll={e => {
              const {contentOffset, contentSize, layoutMeasurement} =
                e.nativeEvent
              setHasMoreAbove(contentOffset.y > 1)
              setHasMoreBelow(
                contentOffset.y + layoutMeasurement.height <
                  contentSize.height - 1,
              )
            }}
            onContentSizeChange={(_, height) =>
              setHasMoreBelow(height > recordsMaxHeight)
            }
            style={{maxHeight: recordsMaxHeight}}
            contentContainerStyle={[a.px_md]}>
            {/* Loads after the records; hidden if it fails or there are none. */}
            {!isBlobCountError && blobCount !== 0 && (
              <View style={[a.py_md]}>
                <CountRow
                  label={l`Photos & videos`}
                  count={blobCount === undefined ? '…' : formatCount(blobCount)}
                  emphasis
                />
              </View>
            )}
            {data.services.map((service, index) => (
              <ServiceRow
                key={service.key}
                service={service}
                formatCount={formatRecordCount}
                isFirst={index === 0 && (isBlobCountError || blobCount === 0)}
              />
            ))}
          </ScrollView>
          {/* Inset shadows hinting there's more to scroll in that direction. */}
          <LinearGradient
            pointerEvents="none"
            colors={[shadowColor, clearColor]}
            style={[
              a.absolute,
              a.left_0,
              a.right_0,
              a.top_0,
              {height: 32, opacity: hasMoreAbove ? 1 : 0},
              web({transition: 'opacity 60ms ease-out'}),
            ]}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[clearColor, shadowColor]}
            style={[
              a.absolute,
              a.left_0,
              a.right_0,
              a.bottom_0,
              {height: 32, opacity: hasMoreBelow ? 1 : 0},
              web({transition: 'opacity 60ms ease-out'}),
            ]}
          />
        </View>
      ) : (
        <Text style={[t.atoms.text_contrast_medium]}>
          <Trans>Your account doesn’t have any records yet.</Trans>
        </Text>
      )}

      {!isLoading && (
        <View style={[a.gap_sm, a.pt_xl]}>
          {useHostingProvider ? (
            <Button
              testID="accountFootprintVisitPdsButton"
              label={
                action === 'delete'
                  ? l`Delete on ${pdsAccountLink.host}`
                  : l`Deactivate on ${pdsAccountLink.host}`
              }
              size="large"
              color="negative"
              onPress={() => openLink(pdsAccountLink.url)}>
              <ButtonText numberOfLines={1} style={[a.flex_shrink]}>
                {action === 'delete' ? (
                  <Trans>Delete on {pdsAccountLink.host}</Trans>
                ) : (
                  <Trans>Deactivate on {pdsAccountLink.host}</Trans>
                )}
              </ButtonText>
              <ButtonIcon icon={ExternalIcon} />
            </Button>
          ) : (
            <Button
              testID="accountFootprintConfirmButton"
              label={
                action === 'delete' ? l`Delete account` : l`Deactivate account`
              }
              size="large"
              color="negative"
              onPress={() => control.close(onConfirm)}>
              <ButtonText>
                {action === 'delete' ? (
                  <Trans>Delete account</Trans>
                ) : (
                  <Trans>Deactivate account</Trans>
                )}
              </ButtonText>
            </Button>
          )}
          <Button
            testID="accountFootprintCancelButton"
            label={l`Cancel`}
            size="large"
            color="secondary"
            onPress={() => control.close()}>
            <ButtonText>
              <Trans>Cancel</Trans>
            </ButtonText>
          </Button>
          {useHostingProvider && !pdsAccountLink.isBlueskyHosted && (
            <Text
              style={[
                a.pt_xs,
                a.text_sm,
                a.text_center,
                t.atoms.text_contrast_medium,
              ]}>
              {action === 'delete' ? (
                <Trans>
                  If this page doesn’t open, your hosting provider can delete
                  your account for you.
                </Trans>
              ) : (
                <Trans>
                  If this page doesn’t open, your hosting provider can
                  deactivate your account for you.
                </Trans>
              )}
            </Text>
          )}
        </View>
      )}

      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}

function LoadingBar() {
  const t = useTheme()
  const [width, setWidth] = useState(0)
  const position = useSharedValue(0)

  useEffect(() => {
    position.set(withRepeat(withTiming(1, {duration: 1200}), -1, false))
    return () => cancelAnimation(position)
  }, [position])

  const segmentWidth = width * 0.35
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: -segmentWidth + position.get() * (width + segmentWidth),
      },
    ],
  }))

  return (
    <View
      accessibilityRole="progressbar"
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
      style={[
        a.w_full,
        a.rounded_full,
        a.overflow_hidden,
        t.atoms.bg_contrast_50,
        {height: 8},
      ]}>
      <Animated.View
        style={[
          a.h_full,
          a.rounded_full,
          {width: segmentWidth, backgroundColor: t.palette.primary_500},
          animatedStyle,
        ]}
      />
    </View>
  )
}

/** How many record types a service shows before folding the rest. */
const VISIBLE_RECORD_TYPES = 5

function ServiceRow({
  service,
  formatCount,
  isFirst = false,
}: {
  service: ServiceFootprint
  formatCount: (count: number) => string
  isFirst?: boolean
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const [expanded, setExpanded] = useState(false)

  const canFold = service.collections.length > VISIBLE_RECORD_TYPES + 1
  const visible =
    canFold && !expanded
      ? service.collections.slice(0, VISIBLE_RECORD_TYPES)
      : service.collections
  const hidden = service.collections.slice(visible.length)
  const hiddenTotal = hidden.reduce((sum, c) => sum + c.count, 0)

  return (
    <View
      style={[
        a.py_md,
        a.gap_xs,
        !isFirst && a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <CountRow
        label={service.name}
        count={formatCount(service.total)}
        emphasis
      />
      {visible.map(collection => (
        <CountRow
          key={collection.nsid}
          label={getRecordLabel(collection.nsid, d => i18n._(d))}
          count={formatCount(collection.count)}
        />
      ))}
      {hidden.length > 0 && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={l`Show ${hidden.length} more record types`}
          accessibilityHint={l`Expands the list of record types`}
          onPress={() => setExpanded(true)}>
          {({pressed}) => (
            <CountRow
              label={plural(hidden.length, {
                one: '+ # more type',
                other: '+ # more types',
              })}
              count={formatCount(hiddenTotal)}
              link
              pressed={pressed}
            />
          )}
        </Pressable>
      )}
    </View>
  )
}

function CountRow({
  label,
  count,
  emphasis = false,
  link = false,
  pressed = false,
}: {
  label: string
  count: string
  emphasis?: boolean
  link?: boolean
  pressed?: boolean
}) {
  const t = useTheme()
  const textStyle = [
    emphasis ? [a.text_md, a.font_semi_bold] : a.text_sm,
    emphasis
      ? t.atoms.text
      : link
        ? {color: t.palette.primary_500}
        : t.atoms.text_contrast_high,
    pressed && {opacity: 0.6},
  ]

  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.justify_between,
        a.gap_md,
        emphasis && a.pb_2xs,
      ]}>
      <Text emoji style={[a.flex_1, textStyle]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[
          textStyle,
          !emphasis && !link && t.atoms.text,
          {fontVariant: ['tabular-nums']},
        ]}>
        {count}
      </Text>
    </View>
  )
}
