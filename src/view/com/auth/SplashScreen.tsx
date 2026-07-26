import {View} from 'react-native'
import Animated, {FadeIn, FadeOut} from 'react-native-reanimated'
import {LinearGradient} from 'expo-linear-gradient'
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
  const isDarkMode = t.name !== 'light'

  const playHaptic = useHaptics()

  return (
    <>
      {/*
       * mu fork: brand-accent gradient in place of the upstream Bluesky
       * illustration. Colours come from the theme palette so it follows the
       * active accent and dark mode.
       */}
      <LinearGradient
        colors={
          isDarkMode
            ? [t.palette.primary_800, t.palette.primary_975]
            : [t.palette.primary_400, t.palette.primary_600]
        }
        start={{x: 0, y: 0}}
        end={{x: 0, y: 1}}
        style={[a.absolute, a.inset_0]}
      />

      <Animated.View
        entering={FadeIn.duration(90)}
        exiting={FadeOut.duration(90)}
        style={[a.flex_1]}>
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
            testID="createAccountButton"
            onPress={() => {
              onPressCreateAccount()
              playHaptic('Light')
            }}
            label={_(msg`Create new account`)}
            accessibilityHint={_(
              msg`Opens flow to create a new Bluesky account`,
            )}
            size="large"
            color={isDarkMode ? 'secondary_inverted' : 'secondary'}
            style={[
              t.atoms.shadow_md,
              {
                shadowOpacity: 0.1,
                shadowOffset: {
                  width: 0,
                  height: 5,
                },
              },
            ]}>
            <ButtonText>
              <Trans>Create account</Trans>
            </ButtonText>
          </Button>

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
            hoverStyle={{opacity: 0.5}}>
            <ButtonText style={{color: 'white'}}>
              <Trans>Sign in</Trans>
            </ButtonText>
          </Button>
        </View>
      </Animated.View>
    </>
  )
}
