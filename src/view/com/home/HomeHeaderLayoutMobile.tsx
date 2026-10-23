import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'

import {HITSLOP_10} from '#/lib/constants'
import {PressableScale} from '#/lib/custom-animations/PressableScale'
import {useHaptics} from '#/lib/haptics'
import {type NavigationProp} from '#/lib/routes/types'
import {emitSoftReset} from '#/state/events'
import {useSession} from '#/state/session'
import {useShellLayout} from '#/state/shell/shell-layout'
import {useHomeHeaderTransform} from '#/view/com/util/MainScrollProvider'
import {Logo} from '#/view/icons/Logo'
import {atoms as a, useTheme} from '#/alf'
import {ButtonIcon} from '#/components/Button'
import {Hashtag_Stroke2_Corner0_Rounded as FeedsIcon} from '#/components/icons/Hashtag'
import * as Layout from '#/components/Layout'
import {InlineLinkText, Link} from '#/components/Link'
import {useAnalytics} from '#/analytics'
import {IS_DEV, IS_LIQUID_GLASS, IS_PARTNER_PREVIEW, IS_WEB} from '#/env'

export function HomeHeaderLayoutMobile({
  children,
}: {
  children: React.ReactNode
  tabBarAnchor: React.ReactElement | null | undefined
}) {
  const t = useTheme()
  const {_} = useLingui()
  const ax = useAnalytics()
  const {headerHeight} = useShellLayout()
  const insets = useSafeAreaInsets()
  const headerMinimalShellTransform = useHomeHeaderTransform()
  const {hasSession} = useSession()
  const playHaptic = useHaptics()
  const {navigate} = useNavigation<NavigationProp>()

  const logo = (
    <PressableScale
      targetScale={0.9}
      onPress={() => {
        if (IS_DEV) {
          navigate('Debug')
        } else {
          playHaptic('Light')
          emitSoftReset()
        }
      }}>
      <Logo width={88} />
    </PressableScale>
  )

  return (
    <Animated.View
      style={[
        a.fixed,
        a.z_10,
        t.atoms.bg,
        {
          top: 0,
          left: 0,
          right: 0,
        },
        // Eurosky fork: the home header is position:fixed at top:0, so on web
        // (incl. standalone PWA) it must pad past the notch/Dynamic Island.
        // Other screens get this via Layout.Screen; the fixed home header does not.
        (IS_LIQUID_GLASS || IS_WEB) && {paddingTop: insets.top},
        headerMinimalShellTransform,
      ]}
      onLayout={e => {
        headerHeight.set(e.nativeEvent.layout.height)
      }}>
      {IS_PARTNER_PREVIEW ? (
        /*
         * Oso: the logo stays centred between two equal sides, so the
         * "Manage feeds" text never runs into it; on very narrow phones the
         * text wraps instead.
         */
        <Layout.Header.Outer noBottomBorder>
          <View style={[a.flex_1, a.align_start]}>
            <Layout.Header.MenuButton />
          </View>
          {logo}
          <View style={[a.flex_1, a.align_end, a.pl_sm]}>
            {hasSession && (
              <InlineLinkText
                to="/feeds"
                label={_(msg`View your feeds and explore more`)}
                onPress={() => {
                  ax.metric('nav:click', {item: 'feeds', surface: 'topBar'})
                }}
                style={[
                  a.text_sm,
                  a.text_right,
                  a.font_medium,
                  t.atoms.text_contrast_medium,
                  {maxWidth: '100%'},
                ]}>
                <Trans>Manage feeds</Trans>
              </InlineLinkText>
            )}
          </View>
        </Layout.Header.Outer>
      ) : (
        <Layout.Header.Outer noBottomBorder>
          <Layout.Header.Slot>
            <Layout.Header.MenuButton />
          </Layout.Header.Slot>

          <View style={[a.flex_1, a.align_center]}>{logo}</View>

          <Layout.Header.Slot>
            {hasSession && (
              <Link
                testID="viewHeaderHomeFeedPrefsBtn"
                to={{screen: 'Feeds'}}
                hitSlop={HITSLOP_10}
                label={_(msg`View your feeds and explore more`)}
                size="small"
                variant="ghost"
                color="secondary"
                shape="square"
                onPress={() => {
                  ax.metric('nav:click', {item: 'feeds', surface: 'topBar'})
                }}
                style={[
                  a.justify_center,
                  {marginRight: -Layout.BUTTON_VISUAL_ALIGNMENT_OFFSET},
                  a.bg_transparent,
                ]}>
                <ButtonIcon icon={FeedsIcon} size="lg" />
              </Link>
            )}
          </Layout.Header.Slot>
        </Layout.Header.Outer>
      )}
      {children}
    </Animated.View>
  )
}
