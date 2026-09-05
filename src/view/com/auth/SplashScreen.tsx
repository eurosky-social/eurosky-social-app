import {View} from 'react-native'
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {useHaptics} from '#/lib/haptics'
import {LogoHero} from '#/view/icons/LogoHero'
import {atoms as a, useTheme} from '#/alf'
import {BetaTag} from '#/components/BetaTag'
import {Button, ButtonText} from '#/components/Button'

export const SplashScreen = ({
  onPressSignin,
  onPressCreateAccount,
}: {
  onPressSignin: () => void
  onPressCreateAccount: () => void
}) => {
  const t = useTheme()
  const {_} = useLingui()

  const playHaptic = useHaptics()

  return (
    <Animated.View
      entering={FadeIn.duration(90)}
      exiting={FadeOut.duration(90)}
      style={[a.flex_1, t.atoms.bg]}>
      <View
        style={[a.justify_center, a.align_center, {gap: 6, paddingTop: 46}]}>
        <LogoHero width={120} />
        <BetaTag />
      </View>

      <View style={[a.flex_1]} />

      <View
        testID="signinOrCreateAccount"
        style={[a.px_5xl, a.gap_md, a.pb_sm]}>
        <Button
          testID="signInButton"
          onPress={() => {
            onPressSignin()
            playHaptic('Light')
          }}
          label={_(msg`Sign in`)}
          accessibilityHint={_(
            msg`Opens flow to sign in to your existing Bluesky account`,
          )}
          size="large"
          color="primary"
          style={[
            {
              shadowColor: t.palette.black,
              shadowRadius: 8,
              shadowOpacity: 0.1,
              shadowOffset: {
                width: 0,
                height: 5,
              },
              elevation: 16,
            },
          ]}>
          <ButtonText>
            <Trans>Sign in</Trans>
          </ButtonText>
        </Button>

        <Button
          testID="createAccountButton"
          onPress={() => {
            onPressCreateAccount()
            playHaptic('Light')
          }}
          label={_(msg`Create new account`)}
          accessibilityHint={_(msg`Opens flow to create a new Bluesky account`)}
          size="large"
          color="secondary_inverted">
          <ButtonText>
            <Trans>Create account</Trans>
          </ButtonText>
        </Button>
      </View>
    </Animated.View>
  )
}
