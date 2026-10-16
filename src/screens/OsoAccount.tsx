import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {
  type CommonNavigatorParams,
  type NativeStackScreenProps,
} from '#/lib/routes/types'
import {useSession, useSessionApi} from '#/state/session'
import {useLoggedOutViewControls} from '#/state/shell/logged-out'
import {useCloseAllActiveElements} from '#/state/util'
import {atoms as a, useTheme} from '#/alf'
import * as Layout from '#/components/Layout'
import * as Prompt from '#/components/Prompt'
import {OSO_COLORS} from '#/features/osoLanding/theme'
import {OsoTileGrid} from '#/features/osoLanding/TileGrid'
import {OsoNavFooter} from '#/features/osoNav'

type Props = NativeStackScreenProps<CommonNavigatorParams, 'OsoAccount'>

/**
 * Oso's account page, opened from the avatar in the phone-width bottom bar:
 * tiles for the profile, settings, adding an account and signing out, with
 * the FAQ, Donate, Terms and Privacy links underneath.
 */
export function OsoAccountScreen({navigation}: Props) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const {logoutEveryAccount} = useSessionApi()
  const {setShowLoggedOut} = useLoggedOutViewControls()
  const closeEverything = useCloseAllActiveElements()
  const signOutPromptControl = Prompt.usePromptControl()

  return (
    <Layout.Screen testID="osoAccountScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            {currentAccount?.handle ? `@${currentAccount.handle}` : ''}
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Center>
        <View style={[a.align_center, a.px_xl, a.pt_4xl, a.gap_xl]}>
          <OsoTileGrid
            holeColor={t.atoms.bg.backgroundColor}
            tiles={[
              {
                testID: 'osoAccountProfile',
                label: l({
                  message: 'profile',
                  comment:
                    'Oso account page tile linking to the user’s own profile. Lowercase on purpose.',
                }),
                hint: l`Opens your profile`,
                onPress: () => {
                  if (currentAccount) {
                    navigation.navigate('Profile', {
                      name: currentAccount.handle || currentAccount.did,
                    })
                  }
                },
              },
              {
                testID: 'osoAccountSettings',
                label: l({
                  message: 'settings',
                  comment:
                    'Oso account page tile linking to settings. Lowercase on purpose.',
                }),
                hint: l`Opens settings`,
                fontScale: 0.9,
                onPress: () => navigation.navigate('Settings'),
              },
              {
                testID: 'osoAccountAddAccount',
                label: l({
                  message: 'add account',
                  comment:
                    'Oso account page tile for signing in to another account. Lowercase on purpose.',
                }),
                hint: l`Sign in to another account`,
                fontScale: 0.86,
                onPress: () => {
                  setShowLoggedOut(true)
                  closeEverything()
                },
              },
            ]}
            moreTiles={[
              {
                testID: 'osoAccountSignOut',
                label: l({
                  message: 'sign out',
                  comment:
                    'Oso account page tile for signing out. Lowercase on purpose.',
                }),
                hint: l`Signs you out of all your accounts`,
                colors: {background: OSO_COLORS.lemon, text: OSO_COLORS.grey},
                onPress: () => signOutPromptControl.open(),
              },
            ]}
          />
          <OsoNavFooter links={['faq', 'donate', 'terms', 'privacy']} />
        </View>
      </Layout.Center>
      <Prompt.Basic
        control={signOutPromptControl}
        title={l`Sign out?`}
        description={l`You will be signed out of all your accounts.`}
        onConfirm={() => logoutEveryAccount('Settings')}
        confirmButtonCta={l`Sign out`}
        cancelButtonCta={l`Cancel`}
        confirmButtonColor="negative"
      />
    </Layout.Screen>
  )
}
