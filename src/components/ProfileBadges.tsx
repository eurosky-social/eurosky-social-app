import {View} from 'react-native'

import {isCakeDay} from '#/lib/cake-day'
import {HITSLOP_20} from '#/lib/constants'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {useTickEveryMinute} from '#/state/shell/tick-every-minute'
import {atoms as a, useAlf, type ViewStyleProp} from '#/alf'
import {useNativeFontScale} from '#/alf/util/dimensions'
import {BotBadge, BotBadgeButton, isBotAccount} from '#/components/BotBadge'
import {CakeDayBadge} from '#/components/CakeDayBadge'
import {useSimpleVerificationState} from '#/components/verification'
import {VerificationCheck} from '#/components/verification/VerificationCheck'
import {VerificationCheckButton} from '#/components/verification/VerificationCheckButton'
import type * as bsky from '#/types/bsky'

export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const verificationIconSizes: Record<Size, number> = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 18,
  xl: 22,
} as const

const botIconSizes: Record<Size, number> = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 19,
  xl: 23,
} as const

/*
 * Inside a Text, the badges sit with their bottom on the baseline on every
 * platform (iOS needs patches/react-native/inline-view-baseline.patch). They
 * are a little taller than the cap height of the names they follow, which
 * leaves them about 0.75pt above its centre on iOS, Android and web (measured
 * in the Storybook "Profile badges" section), so nudge them down by that.
 */
const INLINE_OFFSET = 0.75

export function ProfileBadges({
  profile,
  interactive = false,
  inline = false,
  size,
  style,
  allowFontScaling = true,
}: ViewStyleProp & {
  profile: bsky.profile.AnyProfileView
  interactive?: boolean
  /**
   * Set when the badges are rendered inside a `Text`, after a name, so that
   * they're centred on the name's cap height.
   */
  inline?: boolean
  size: Size
  allowFontScaling?: boolean
}) {
  const shadowed = useProfileShadow(profile)
  const verification = useSimpleVerificationState({profile})
  const tick = useTickEveryMinute(Boolean(shadowed.createdAt))
  const showCake = isCakeDay(shadowed.createdAt, tick || Date.now())
  const badgeVisibility = [
    verification.showBadge,
    isBotAccount(shadowed),
    showCake,
  ]
  const badgeCount = badgeVisibility.filter(Boolean).length
  const nativeScaleMultiplier = useNativeFontScale()
  const {
    fonts: {scaleMultiplier: alfScaleMultiplier},
  } = useAlf()

  // if nothing to show, don't render the container at all
  if (badgeCount < 1) return null

  const isOnTheSmallSide = size === 'xs' || size === 'sm'

  const scaleMultiplier = allowFontScaling
    ? nativeScaleMultiplier * alfScaleMultiplier
    : 1

  const verificationIconWidth = verificationIconSizes[size] * scaleMultiplier
  const botIconWidth = botIconSizes[size] * scaleMultiplier

  const gap = isOnTheSmallSide ? a.gap_2xs : a.gap_xs
  const padding = gap.gap / 2
  const hitSlops = []
  let visibleBadgeIndex = 0
  for (const isVisible of badgeVisibility) {
    if (!isVisible) {
      hitSlops.push(HITSLOP_20)
      continue
    }
    const index = visibleBadgeIndex++
    hitSlops.push({
      ...HITSLOP_20,
      left: index === 0 ? HITSLOP_20.left : padding,
      right: index === badgeCount - 1 ? HITSLOP_20.right : padding,
    })
  }

  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        gap,
        inline && [
          a.px_2xs,
          {transform: [{translateY: INLINE_OFFSET * scaleMultiplier}]},
        ],
        style,
      ]}>
      {interactive ? (
        <>
          <VerificationCheckButton
            profile={shadowed}
            width={verificationIconWidth}
            hitSlop={hitSlops[0]}
          />
          <BotBadgeButton
            profile={shadowed}
            width={botIconWidth}
            hitSlop={hitSlops[1]}
          />
        </>
      ) : (
        <>
          {verification.showBadge ? (
            <VerificationCheck
              verifier={verification.role === 'verifier'}
              width={verificationIconWidth}
            />
          ) : null}
          <BotBadge profile={shadowed} width={botIconWidth} />
        </>
      )}
      {showCake && (
        <CakeDayBadge
          width={botIconWidth}
          interactive={interactive}
          hitSlop={hitSlops[2]}
        />
      )}
    </View>
  )
}
