import {ScrollView, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {Trans, useLingui} from '@lingui/react/macro'

import {useSessionApi} from '#/state/session'
import {DeactivateAccountDialog} from '#/screens/Settings/components/DeactivateAccountDialog'
import {DeleteAccountDialog} from '#/screens/Settings/components/DeleteAccountDialog'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {AgeAssuranceBadge} from '#/components/ageAssurance/AgeAssuranceBadge'
import {Button, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {Full as Logo} from '#/components/icons/Logo'
import {createStaticClick, SimpleInlineLinkText} from '#/components/Link'
import {Outlet as PortalOutlet} from '#/components/Portal'
import {Text} from '#/components/Typography'
import {BottomSheetOutlet} from '#/../modules/bottom-sheet'
import {useAgeAssurance} from '#/ageAssurance'
import {BRAND} from '#/config/brand'
import {IS_WEB} from '#/env'
import {OsoAgeConfirmationDialog} from '#/features/osoAgeGate/OsoAgeConfirmationDialog'
import {useIsDeclaredUnder18} from '#/features/osoAgeGate/useOsoAgeGate'

export {useOsoAgeGate} from '#/features/osoAgeGate/useOsoAgeGate'

const textStyles = [a.text_md, a.leading_snug]

/**
 * Oso's 18+ age gate, replacing the shared NoAccessScreen in the shell. Shown
 * while the user hasn't declared their age, has declared under 18, or is in a
 * region that requires verified age assurance.
 */
export function OsoNoAccessScreen() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtPhone} = useBreakpoints()
  const insets = useSafeAreaInsets()
  const ageControl = useDialogControl()
  const deactivateAccountControl = useDialogControl()
  const deleteAccountControl = useDialogControl()
  const {logoutCurrentAccount} = useSessionApi()
  const aa = useAgeAssurance()
  const isDeclaredUnder18 = useIsDeclaredUnder18()

  const onPressLogout = () => {
    if (IS_WEB) {
      // Switching accounts remounts the app, so reset the URL ourselves.
      history.pushState(null, '', '/')
    }
    logoutCurrentAccount('AgeAssuranceNoAccessScreen')
  }

  const updateAge = (
    <Text style={textStyles}>
      <Trans>
        If this is wrong, you can{' '}
        <SimpleInlineLinkText
          label={l`Update your age`}
          style={textStyles}
          {...createStaticClick(() => {
            ageControl.open()
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

            {isDeclaredUnder18 ? (
              <View style={[a.gap_lg]}>
                <Text style={textStyles}>
                  <Trans>You must be 18 or older to use {BRAND.name}.</Trans>
                </Text>
                {updateAge}
              </View>
            ) : !aa.flags.hasDeclaredAge ? (
              <View style={[a.gap_lg]}>
                <Text style={textStyles}>
                  <Trans>Hi there!</Trans>
                </Text>
                <Text style={textStyles}>
                  <Trans>
                    {BRAND.name} is only available to people aged 18 or older.
                    Please confirm your age to continue. This is a one-time
                    thing, and your data stays private.
                  </Trans>
                </Text>
                <Button
                  color="primary"
                  size="large"
                  label={l`Confirm your age`}
                  onPress={() => ageControl.open()}
                  testID="osoAgeGateConfirmButton">
                  <ButtonText>
                    <Trans>Confirm your age</Trans>
                  </ButtonText>
                </Button>
              </View>
            ) : (
              <View style={[a.gap_lg]}>
                <Text style={textStyles}>
                  <Trans>
                    {BRAND.name} isn’t available in your region, which legally
                    requires verified age assurance.
                  </Trans>
                </Text>
                {updateAge}
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
                    label={l`Click here to log out`}
                    {...createStaticClick(() => {
                      onPressLogout()
                    })}
                    style={[a.italic]}>
                    click here
                  </SimpleInlineLinkText>
                  . Or if you’d prefer, you can{' '}
                  <SimpleInlineLinkText
                    label={l`Click here to delete your account`}
                    {...createStaticClick(() => {
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

      <OsoAgeConfirmationDialog control={ageControl} />
      <DeactivateAccountDialog control={deactivateAccountControl} />
      <DeleteAccountDialog
        control={deleteAccountControl}
        deactivateDialogControl={deactivateAccountControl}
      />

      {/*
       * The shell isn't mounted behind this screen, so dialogs need their own
       * outlets here.
       */}
      <BottomSheetOutlet />
      <PortalOutlet />
    </>
  )
}
