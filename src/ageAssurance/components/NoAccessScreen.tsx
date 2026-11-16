import {useCallback, useEffect, useEffectEvent, useState} from 'react'
import {ScrollView, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {BottomSheetOutlet} from '@bsky.app/bottom-sheet'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {dateDiff, useGetTimeAgo} from '#/lib/hooks/useTimeAgo'
import {formatDateTime} from '#/lib/strings/time'
import {useAppviewClient, useSessionApi} from '#/state/session'
import {DeactivateAccountDialog} from '#/screens/Settings/components/DeactivateAccountDialog'
import {DeleteAccountDialog} from '#/screens/Settings/components/DeleteAccountDialog'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {AgeAssuranceAppealDialog} from '#/components/ageAssurance/AgeAssuranceAppealDialog'
import {AgeAssuranceBadge} from '#/components/ageAssurance/AgeAssuranceBadge'
import {AgeAssuranceInitDialog} from '#/components/ageAssurance/AgeAssuranceInitDialog'
import {MuAgeConfirmDialog} from '#/components/ageAssurance/MuAgeConfirmDialog'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {DeviceLocationRequestDialog} from '#/components/dialogs/DeviceLocationRequestDialog'
import {Full as Logo} from '#/components/icons/Logo'
import {ShieldCheck_Stroke2_Corner0_Rounded as ShieldIcon} from '#/components/icons/Shield'
import {createStaticClick, SimpleInlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Outlet as PortalOutlet} from '#/components/Portal'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {refetchAgeAssuranceServerState, useAgeAssurance} from '#/ageAssurance'
import {DeviceSignalsNotice} from '#/ageAssurance/components/DeviceSignalsNotice'
import {useAgeAssuranceServerDataContext} from '#/ageAssurance/data'
import {getNoAccessReason} from '#/ageAssurance/noAccessReason'
import {useComputeAgeAssuranceRegionAccess} from '#/ageAssurance/useComputeAgeAssuranceRegionAccess'
import {useAgeAssuranceVerificationFlow} from '#/ageAssurance/useVerificationFlow'
import {useAgeAssuranceRegionConfig} from '#/ageAssurance/util'
import {useAnalytics} from '#/analytics'
import {BRAND} from '#/config/brand'
import {IS_NATIVE, IS_WEB} from '#/env'
import {useDeviceGeolocationApi} from '#/geolocation'

const textStyles = [a.text_md, a.leading_snug]

/**
 * mu fork: the age gate. Shown by the shell when access === None. The cases
 * (see getNoAccessReason):
 *
 *  - not declared yet     -> the one-time birthdate prompt (the gate itself)
 *  - declared, under 13   -> blocked everywhere
 *  - declared, below the region minimum age -> blocked in this region
 *  - declared, over the minimum but the region only grants access on a
 *    *verified* age (US-MS; US-TX on native) -> the same verification flow as
 *    the account settings card: KWS, or the device's age signals where the
 *    region allows them. A declared adult in the UK gets restricted access and
 *    verifies from that card; here the gate is the only screen they can reach,
 *    so it has to offer the flow itself.
 */
export function NoAccessScreen() {
  const t = useTheme()
  const {_} = useLingui()
  const ax = useAnalytics()
  const {gtPhone} = useBreakpoints()
  const insets = useSafeAreaInsets()
  const birthdateControl = useDialogControl()
  const deactivateAccountControl = useDialogControl()
  const deleteAccountControl = useDialogControl()
  const {metadata} = useAgeAssuranceServerDataContext()
  const region = useAgeAssuranceRegionConfig()
  const {logoutCurrentAccount} = useSessionApi()

  const aa = useAgeAssurance()
  const isAARegion = !!region
  const hasDeclaredAge = metadata?.declaredAge !== undefined
  const isBlocked = aa.state.status === aa.Status.Blocked
  const reason = getNoAccessReason({
    hasDeclaredAge,
    isOverAppMinAccessAge: aa.flags.isOverAppMinAccessAge,
    isAARegion,
    isOverRegionMinAccessAge: aa.flags.isOverRegionMinAccessAge,
  })

  const onShown = useEffectEvent(() => {
    ax.metric(`ageAssurance:noAccessScreen:shown`, {
      accountCreatedAt: metadata?.accountCreatedAt || 'unknown',
      isAARegion,
      hasDeclaredAge,
      canUpdateBirthday: true,
    })
  })

  useEffect(() => {
    onShown()
  }, [])

  const onPressLogout = useCallback(() => {
    if (IS_WEB) {
      // We're switching accounts, which remounts the entire app. We change the
      // URL ourselves since the navigator is about to unmount.
      history.pushState(null, '', '/')
    }
    logoutCurrentAccount('AgeAssuranceNoAccessScreen')
  }, [logoutCurrentAccount])

  const updateAge = (
    <Text style={textStyles}>
      <Trans>
        If this is wrong, you can{' '}
        <SimpleInlineLinkText
          label={_(msg`Update your age`)}
          style={textStyles}
          {...createStaticClick(() => {
            ax.metric('ageAssurance:noAccessScreen:openBirthdateDialog', {})
            birthdateControl.open()
          })}>
          update it here
        </SimpleInlineLinkText>
        .
      </Trans>
    </Text>
  )

  return (
    <>
      <View style={[a.util_screen_outer, a.flex_1]}>
        <ScrollView
          contentContainerStyle={[
            a.px_2xl,
            {
              paddingTop: IS_WEB
                ? a.p_5xl.padding
                : insets.top + a.p_2xl.padding,
              paddingBottom: 100,
            },
          ]}>
          <View
            style={[
              a.mx_auto,
              a.w_full,
              web({
                maxWidth: 380,
                paddingTop: gtPhone ? '8vh' : undefined,
              }),
              {gap: 32},
            ]}>
            <View style={[a.align_start]}>
              <AgeAssuranceBadge />
            </View>

            {reason === 'undeclared' ? (
              <View style={[a.gap_lg]}>
                <Text style={textStyles}>
                  <Trans>Hi there!</Trans>
                </Text>
                <Text style={textStyles}>
                  <Trans>
                    To give you an age-appropriate experience, we need to
                    confirm that you are 18 or older. This is a one-time thing,
                    and your data stays private.
                  </Trans>
                </Text>
                <Button
                  color="primary"
                  size="large"
                  label={_(msg`Confirm your age`)}
                  onPress={() => birthdateControl.open()}>
                  <ButtonText>
                    <Trans>Confirm your age</Trans>
                  </ButtonText>
                </Button>
                <Admonition type="tip">
                  <Trans>
                    For organizational accounts, confirm based on the person who
                    is responsible for the account.
                  </Trans>
                </Admonition>
              </View>
            ) : reason === 'under-app-min' ? (
              <View style={[a.gap_lg]}>
                <Text style={textStyles}>
                  <Trans>
                    You must be at least 13 years old to use {BRAND.name}.
                  </Trans>
                </Text>
                {updateAge}
              </View>
            ) : reason === 'under-region-min' ? (
              <View style={[a.gap_lg]}>
                <Text style={textStyles}>
                  <Trans>
                    Your declared age is below the minimum required to use{' '}
                    {BRAND.name} in your region.
                  </Trans>
                </Text>
                {updateAge}
              </View>
            ) : (
              <View style={[a.gap_xl]}>
                <View style={[a.gap_lg]}>
                  <Text style={textStyles}>
                    <Trans>
                      You are accessing {BRAND.name} from a region that legally
                      requires us to verify your age before you can use the app.
                    </Trans>
                  </Text>
                  {!isBlocked && updateAge}
                </View>
                <VerifySection />
                {IS_NATIVE && <LocationCorrection />}
              </View>
            )}

            <View style={[a.pt_lg, a.gap_xl, {maxWidth: 280}]}>
              <Logo width={120} textFill={t.atoms.text.color} />
              <Text
                style={[
                  a.text_sm,
                  a.italic,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                ]}>
                <Trans>
                  To log out,{' '}
                  <SimpleInlineLinkText
                    label={_(msg`Click here to log out`)}
                    {...createStaticClick(() => {
                      onPressLogout()
                    })}
                    style={[a.italic]}>
                    click here
                  </SimpleInlineLinkText>
                  . Or if you’d prefer, you can{' '}
                  <SimpleInlineLinkText
                    label={_(msg`Click here to delete your account`)}
                    {...createStaticClick(() => {
                      ax.metric(
                        'ageAssurance:noAccessScreen:openDeleteAccountDialog',
                        {},
                      )
                      deleteAccountControl.open()
                    })}
                    style={[a.italic]}>
                    delete your account
                  </SimpleInlineLinkText>
                  .
                </Trans>
              </Text>
            </View>
          </View>
        </ScrollView>
      </View>

      <MuAgeConfirmDialog control={birthdateControl} />
      <DeactivateAccountDialog control={deactivateAccountControl} />
      <DeleteAccountDialog control={deleteAccountControl} />

      {/*
       * While this blocking overlay is up, other dialogs in the shell are not
       * mounted, so it _should_ be safe to use these here without fear of other
       * modals showing up.
       */}
      <BottomSheetOutlet />
      <PortalOutlet />
    </>
  )
}

/**
 * The verification flow for regions that only grant access on a verified age.
 * Mirrors the account settings card (AgeAssuranceAccountCard), plus a way to
 * re-read the status: the server state is cached for an hour, and the KWS
 * flow ends outside the app, so without it a user who just verified would
 * stay behind this gate until the cache expires.
 */
function VerifySection() {
  const t = useTheme()
  const {_, i18n} = useLingui()
  const ax = useAnalytics()
  const initDialogControl = useDialogControl()
  const appealControl = useDialogControl()
  const getTimeAgo = useGetTimeAgo()
  const appviewClient = useAppviewClient()
  const [isChecking, setIsChecking] = useState(false)

  const aa = useAgeAssurance()
  const {status, lastInitiatedAt} = aa.state
  const isBlocked = status === aa.Status.Blocked
  const hasInitiated = !!lastInitiatedAt
  const timeAgo = lastInitiatedAt
    ? getTimeAgo(lastInitiatedAt, new Date())
    : null
  const diff = lastInitiatedAt
    ? dateDiff(lastInitiatedAt, new Date(), 'down')
    : null
  const {
    onPressVerify,
    openInitDialog,
    isVerifying,
    verifyCta,
    deviceSignalsFailed,
  } = useAgeAssuranceVerificationFlow({initDialogControl})
  const useDeviceSignals =
    aa.flags.allowsDeviceVerification && !deviceSignalsFailed

  const onPressCheckAgain = async () => {
    if (isChecking) return
    setIsChecking(true)
    try {
      const data = await refetchAgeAssuranceServerState({appviewClient})
      // An assured status lifts this gate on its own; say so when it didn't.
      if (data?.state.status !== 'assured') {
        Toast.show(
          _(
            msg`Your age isn't verified yet. If you just finished, try again in a minute.`,
          ),
          {type: 'info'},
        )
      }
    } catch {
      Toast.show(_(msg`Couldn't check your status. Please try again.`), {
        type: 'error',
      })
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <>
      <AgeAssuranceInitDialog control={initDialogControl} />
      <AgeAssuranceAppealDialog control={appealControl} />

      {isBlocked ? (
        <Admonition type="warning">
          <Trans>
            You are currently unable to access Bluesky's Age Assurance flow.
            Please{' '}
            <SimpleInlineLinkText
              label={_(msg`Contact our moderation team`)}
              {...createStaticClick(() => {
                appealControl.open()
                ax.metric('ageAssurance:appealDialogOpen', {})
              })}>
              contact our moderation team
            </SimpleInlineLinkText>{' '}
            if you believe this is an error.
          </Trans>
        </Admonition>
      ) : (
        <View style={[a.gap_md]}>
          <Button
            label={verifyCta}
            size="large"
            color={
              hasInitiated || aa.flags.hasSharedDeviceSignals
                ? 'secondary'
                : 'primary'
            }
            disabled={isVerifying}
            onPress={() => void onPressVerify()}>
            <ButtonIcon icon={isVerifying ? Loader : ShieldIcon} />
            <ButtonText>{verifyCta}</ButtonText>
          </Button>

          {useDeviceSignals ? (
            <DeviceSignalsNotice onPressKws={openInitDialog} />
          ) : lastInitiatedAt && timeAgo && diff ? (
            <Text
              style={[a.text_sm, a.italic, t.atoms.text_contrast_medium]}
              title={formatDateTime(i18n, lastInitiatedAt, {
                dateStyle: 'medium',
                timeStyle: 'medium',
              })}>
              {diff.value === 0 ? (
                <Trans>Last initiated just now</Trans>
              ) : (
                <Trans>Last initiated {timeAgo} ago</Trans>
              )}
            </Text>
          ) : (
            <Text style={[a.text_sm, a.italic, t.atoms.text_contrast_medium]}>
              <Trans>Age assurance only takes a few minutes</Trans>
            </Text>
          )}

          {hasInitiated && (
            <Text style={[a.text_sm, a.leading_snug]}>
              <Trans>
                Finished verifying?{' '}
                <SimpleInlineLinkText
                  label={_(msg`Check your verification status`)}
                  style={[a.text_sm]}
                  {...createStaticClick(() => {
                    void onPressCheckAgain()
                  })}>
                  Check again
                </SimpleInlineLinkText>
              </Trans>
            </Text>
          )}
        </View>
      )}
    </>
  )
}

/**
 * Native-only escape hatch: if the user's detected region is wrong, let them
 * re-resolve it via GPS. Only lifts the gate if the corrected location is in an
 * unregulated region (access === Full).
 */
function LocationCorrection() {
  const {_} = useLingui()
  const locationControl = useDialogControl()
  const {setDeviceGeolocation} = useDeviceGeolocationApi()
  const computeAccess = useComputeAgeAssuranceRegionAccess()
  const aa = useAgeAssurance()

  return (
    <>
      <Admonition>
        <Trans>
          Is your location wrong?{' '}
          <SimpleInlineLinkText
            label={_(msg`Update your location`)}
            {...createStaticClick(() => {
              locationControl.open()
            })}>
            Update it with GPS.
          </SimpleInlineLinkText>
        </Trans>
      </Admonition>

      <DeviceLocationRequestDialog
        control={locationControl}
        onLocationAcquired={props => {
          const access = computeAccess(props.geolocation)
          if (access !== aa.Access.Full) {
            props.disableDialogAction()
            props.setDialogError(
              _(
                msg`Based on your device's location, you're still in a region that requires age assurance.`,
              ),
            )
          } else {
            props.closeDialog(() => {
              setDeviceGeolocation(props.geolocation)
              Toast.show(_(msg`Thanks! You're all set.`), {type: 'success'})
            })
          }
        }}
      />
    </>
  )
}
