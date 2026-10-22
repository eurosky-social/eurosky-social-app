import {useState} from 'react'
import {ScrollView, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {Trans, useLingui} from '@lingui/react/macro'

import {useSessionApi} from '#/state/session'
import {DeactivateAccountDialog} from '#/screens/Settings/components/DeactivateAccountDialog'
import {DeleteAccountDialog} from '#/screens/Settings/components/DeleteAccountDialog'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {AgeAssuranceBadge} from '#/components/ageAssurance/AgeAssuranceBadge'
import {useDialogControl} from '#/components/Dialog'
import {createStaticClick, SimpleInlineLinkText} from '#/components/Link'
import {Outlet as PortalOutlet} from '#/components/Portal'
import {Text} from '#/components/Typography'
import {BottomSheetOutlet} from '#/../modules/bottom-sheet'
import {useAgeAssurance} from '#/ageAssurance'
import {BRAND} from '#/config/brand'
import {IS_WEB} from '#/env'
import {AgeConfirmation} from '#/features/osoAgeGate/AgeConfirmation'

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
  const deactivateAccountControl = useDialogControl()
  const deleteAccountControl = useDialogControl()
  const {logoutCurrentAccount} = useSessionApi()
  const aa = useAgeAssurance()
  /*
   * Kept only while the gate is open: a reload asks the age question again,
   * so a mis-click doesn't lock anyone out.
   */
  const [saidUnder18, setSaidUnder18] = useState(false)
  const onDeclareMinor = () => setSaidUnder18(true)

  const onPressLogout = () => {
    if (IS_WEB) {
      // Switching accounts remounts the app, so reset the URL ourselves.
      history.pushState(null, '', '/')
    }
    logoutCurrentAccount('AgeAssuranceNoAccessScreen')
  }

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
              <AgeAssuranceBadge labelText={<Trans>Confirm your age</Trans>} />
            </View>

            {saidUnder18 ? (
              <Text style={textStyles}>
                <Trans>You cannot use {BRAND.name} if you’re under 18.</Trans>
              </Text>
            ) : !aa.flags.hasDeclaredAge || aa.flags.isDeclaredUnderAdultAge ? (
              <View style={[a.gap_lg]}>
                <Text style={textStyles}>
                  <Trans>
                    {BRAND.name} is made for adults. Please confirm that you’re
                    18 or older. This is the first and only time we’ll ask your
                    age. Your data won’t be shared with anyone.
                  </Trans>
                </Text>
                <AgeConfirmation
                  showNote={false}
                  onDeclareMinor={onDeclareMinor}
                />
                <Admonition type="tip">
                  <Trans>
                    For organisations: confirm the age of the person responsible
                    for the account.
                  </Trans>
                </Admonition>
              </View>
            ) : (
              <View style={[a.gap_lg]}>
                <Text style={textStyles}>
                  <Trans>
                    {BRAND.name} isn’t available in your region, which legally
                    requires verified age assurance.
                  </Trans>
                </Text>
                <AgeConfirmation onDeclareMinor={onDeclareMinor} />
              </View>
            )}

            <View style={[a.pt_lg, a.gap_xl, {maxWidth: 280}]}>
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
