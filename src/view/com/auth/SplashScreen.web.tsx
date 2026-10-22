import {useEffect, useState} from 'react'
import {Pressable, View} from 'react-native'
import {useReducedMotion} from 'react-native-reanimated'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {useWebMediaQueries} from '#/lib/hooks/useWebMediaQueries'
import {ErrorBoundary} from '#/view/com/util/ErrorBoundary'
import {LogoHero} from '#/view/icons/LogoHero'
import {
  AppClipOverlay,
  postAppClipMessage,
} from '#/screens/StarterPack/StarterPackLandingScreen'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {AppLanguageDropdown} from '#/components/AppLanguageDropdown'
import {Button, ButtonText} from '#/components/Button'
import {TimesLarge_Stroke2_Corner0_Rounded as TimesIcon} from '#/components/icons/Times'
import * as Layout from '#/components/Layout'
import {InlineLinkText} from '#/components/Link'
import {Text} from '#/components/Typography'
import {BRAND} from '#/config/brand'
import {osoButton} from '#/features/osoAuthStyles'
import {isSignupClosed, SignupClosedNotice} from '#/features/osoSignupGate'

const BACKGROUND_VIDEO: string = require('../../../../assets/brand/oso-landing-page-background.mp4')

export const SplashScreen = ({
  onDismiss,
  onPressSignin,
  onPressCreateAccount,
}: {
  onDismiss?: () => void
  onPressSignin: () => void
  onPressCreateAccount: () => void
}) => {
  const {_} = useLingui()
  const t = useTheme()
  const {isTabletOrMobile: IS_WEB_MOBILE} = useWebMediaQueries()
  const {gtMobile} = useBreakpoints()
  const [showClipOverlay, setShowClipOverlay] = useState(false)

  useEffect(() => {
    const getParams = new URLSearchParams(window.location.search)
    const clip = getParams.get('clip')
    if (clip === 'true') {
      setShowClipOverlay(true)
      postAppClipMessage({
        action: 'present',
      })
    }
  }, [])

  return (
    <>
      {onDismiss && (
        <Pressable
          accessibilityRole="button"
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            padding: 20,
            zIndex: 100,
          }}
          onPress={onDismiss}>
          <TimesIcon width={24} style={t.atoms.text} />
        </Pressable>
      )}

      <View style={[a.flex_1, gtMobile && a.flex_row]}>
        {/*
         * Desktop shows the video in a rounded box in its own column left of the
         * controls, mobile shows it full-bleed behind them.
         */}
        {gtMobile ? (
          <View style={[a.flex_1, a.pt_5xl, a.pl_5xl, a.pb_5xl]}>
            <View style={[a.flex_1, a.rounded_xl, a.overflow_hidden]}>
              <BackgroundVideo />
            </View>
          </View>
        ) : (
          <BackgroundVideo />
        )}
        <View style={a.flex_1}>
          <Layout.Center style={[a.h_full, a.flex_1]} ignoreTabletLayoutOffset>
            <View
              testID="noSessionView"
              style={[
                a.h_full,
                a.justify_center,
                {paddingBottom: '20vh'},
                IS_WEB_MOBILE && a.pb_5xl,
                t.atoms.border_contrast_medium,
                a.align_center,
                a.gap_5xl,
                a.flex_1,
              ]}>
              <ErrorBoundary>
                {/* On mobile this is a card so the controls read over the video */}
                <View
                  style={[
                    a.w_full,
                    a.align_center,
                    a.gap_5xl,
                    !gtMobile && [
                      a.rounded_xl,
                      a.pt_5xl,
                      a.px_5xl,
                      a.pb_xl,
                      t.atoms.bg,
                      {width: 325, maxWidth: '100%'},
                    ],
                  ]}>
                  <View
                    style={[
                      gtMobile && a.pt_5xl,
                      a.pb_sm,
                      a.align_center,
                      {gap: 21},
                    ]}>
                    <LogoHero width={161} />
                    <BetaBadge />
                    <Text
                      style={[
                        a.font_semi_bold,
                        a.text_center,
                        {
                          // Small enough for the Dutch line to fit the 245px
                          // mobile card on one line.
                          fontSize: 19,
                          lineHeight: 19 * 1.1,
                          letterSpacing: -0.12,
                        },
                      ]}>
                      <Trans>your socials, your rules</Trans>
                    </Text>
                  </View>

                  <View
                    testID="signinOrCreateAccount"
                    style={[
                      a.w_full,
                      gtMobile && [a.px_xl, a.pb_2xl],
                      a.gap_md,
                      {maxWidth: 320},
                    ]}>
                    {isSignupClosed() ? (
                      <SignupClosedNotice />
                    ) : (
                      <Button
                        testID="createAccountButton"
                        onPress={onPressCreateAccount}
                        label={_(msg`Create new account`)}
                        accessibilityHint={_(
                          msg`Opens flow to create a new Bluesky account`,
                        )}
                        size="large"
                        variant="solid"
                        color="primary">
                        <ButtonText>
                          <Trans>Create account</Trans>
                        </ButtonText>
                      </Button>
                    )}
                    <Button
                      testID="signInButton"
                      onPress={onPressSignin}
                      label={_(msg`Sign in`)}
                      accessibilityHint={_(
                        msg`Opens flow to sign in to your existing Bluesky account`,
                      )}
                      size="large"
                      variant="outline"
                      color="primary"
                      style={osoButton.greenOutline.style}
                      hoverStyle={osoButton.greenOutline.hoverStyle}>
                      <ButtonText style={osoButton.greenOutline.text}>
                        <Trans>Sign in</Trans>
                      </ButtonText>
                    </Button>
                  </View>
                  {!gtMobile && <CardFooter />}
                </View>
              </ErrorBoundary>
            </View>
          </Layout.Center>
          {gtMobile && <Footer />}
        </View>
      </View>
      <AppClipOverlay
        visible={showClipOverlay}
        setIsVisible={setShowClipOverlay}
      />
    </>
  )
}

/**
 * Looping brand video filling its nearest positioned parent. Stays on the first
 * frame when the user prefers reduced motion.
 */
function BackgroundVideo() {
  const reducedMotion = useReducedMotion()

  return (
    <video
      src={BACKGROUND_VIDEO}
      autoPlay={!reducedMotion}
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        pointerEvents: 'none',
      }}
    />
  )
}

/**
 * Static "BETA" pill under the logo. The lettering is outlined paths, so it is
 * hidden from assistive tech rather than read out letter by letter.
 */
function BetaBadge() {
  return (
    <svg
      width="55"
      height="19"
      viewBox="0 0 55 19"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden>
      <rect width="55" height="19" rx="9.5" fill="#563FFF" />
      <path
        d="M12.7585 14V5.27273H16.2528C16.8949 5.27273 17.4304 5.3679 17.8594 5.55824C18.2884 5.74858 18.6108 6.01278 18.8267 6.35085C19.0426 6.68608 19.1506 7.07244 19.1506 7.50994C19.1506 7.85085 19.0824 8.15057 18.946 8.40909C18.8097 8.66477 18.6222 8.875 18.3835 9.03977C18.1477 9.2017 17.8778 9.31676 17.5739 9.38494V9.47017C17.9062 9.48438 18.2173 9.57812 18.5071 9.75142C18.7997 9.92472 19.0369 10.1676 19.2188 10.4801C19.4006 10.7898 19.4915 11.1591 19.4915 11.5881C19.4915 12.0511 19.3764 12.4645 19.1463 12.8281C18.919 13.1889 18.5824 13.4744 18.1364 13.6847C17.6903 13.8949 17.1406 14 16.4872 14H12.7585ZM14.6037 12.4915H16.108C16.6222 12.4915 16.9972 12.3935 17.233 12.1974C17.4688 11.9986 17.5866 11.7344 17.5866 11.4048C17.5866 11.1634 17.5284 10.9503 17.4119 10.7656C17.2955 10.581 17.1293 10.4361 16.9134 10.331C16.7003 10.2259 16.446 10.1733 16.1506 10.1733H14.6037V12.4915ZM14.6037 8.92472H15.9716C16.2244 8.92472 16.4489 8.88068 16.6449 8.79261C16.8438 8.7017 17 8.57386 17.1136 8.40909C17.2301 8.24432 17.2884 8.04688 17.2884 7.81676C17.2884 7.50142 17.1761 7.24716 16.9517 7.05398C16.7301 6.8608 16.4148 6.7642 16.0057 6.7642H14.6037V8.92472ZM20.5721 14V5.27273H26.4528V6.79403H22.4173V8.87358H26.1502V10.3949H22.4173V12.4787H26.4698V14H20.5721ZM27.4674 6.79403V5.27273H34.635V6.79403H31.9631V14H30.1393V6.79403H27.4674ZM36.1333 14H34.156L37.1688 5.27273H39.5466L42.5551 14H40.5779L38.3918 7.26705H38.3236L36.1333 14ZM36.0097 10.5696H40.6801V12.0099H36.0097V10.5696Z"
        fill="#55FF80"
      />
    </svg>
  )
}

/**
 * Language switcher and legal links inside the mobile card, replacing the
 * page footer there.
 */
function CardFooter() {
  return (
    <View style={[a.align_center, {gap: 30}]}>
      {/* A row, since the dropdown pins itself to the start with alignSelf */}
      <View style={[a.flex_row, a.justify_center]}>
        <AppLanguageDropdown />
      </View>
      <View style={[a.flex_row, a.justify_center, a.gap_lg]}>
        <LegalLinks />
      </View>
    </View>
  )
}

/**
 * Desktop footer pinned to the bottom of the controls column.
 */
function Footer() {
  return (
    <View
      style={[
        a.absolute,
        a.flex_row,
        a.align_center,
        a.justify_between,
        a.gap_lg,
        {left: 40, right: 40, bottom: 40},
      ]}>
      <View style={[a.flex_row, a.flex_wrap, a.gap_lg]}>
        <LegalLinks />
      </View>
      <AppLanguageDropdown />
    </View>
  )
}

function LegalLinks() {
  const t = useTheme()
  const {_} = useLingui()

  return (
    <>
      <InlineLinkText
        style={[a.text_sm, t.atoms.text_contrast_medium]}
        label={_(msg`Terms of Service`)}
        to={BRAND.links.tos}>
        <Trans>Terms of Service</Trans>
      </InlineLinkText>
      <InlineLinkText
        style={[a.text_sm, t.atoms.text_contrast_medium]}
        label={_(msg`Privacy Policy`)}
        to={BRAND.links.privacy}>
        <Trans>Privacy Policy</Trans>
      </InlineLinkText>
    </>
  )
}
