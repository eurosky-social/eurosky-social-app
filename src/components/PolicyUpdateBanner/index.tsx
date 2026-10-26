import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {HITSLOP_10, webLinks} from '#/lib/constants'
import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {CircleInfo_Stroke2_Corner0_Rounded as CircleInfo} from '#/components/icons/CircleInfo'
import {TimesLarge_Stroke2_Corner0_Rounded as X} from '#/components/icons/Times'
import {InlineLinkText} from '#/components/Link'
import {
  POLICY_UPDATE_BANNER_IS_ENABLED,
  POLICY_UPDATE_EFFECTIVE_DATE,
} from '#/components/PolicyUpdateBanner/config'
import {Text} from '#/components/Typography'
import {device, useStorage} from '#/storage'

/**
 * Visibility and dismiss state for the policy update banner.
 *
 * Dismissal is device-scoped rather than NUX-backed: it needs to be
 * synchronous, work while logged out, and not write into
 * `app.bsky.actor.defs#bskyAppStatePref`, which the lexicon reserves for
 * bsky.app. The trade-off is that a user on both phone and web dismisses it
 * once per device.
 *
 * Exported so `PostFeed` can decide whether to insert a row at all, rather
 * than rendering an empty one.
 */
export function usePolicyUpdateBannerState() {
  const [dismissed = false, setDismissed] = useStorage(device, [
    'policyUpdateBannerDismissed',
  ])

  return {
    visible: POLICY_UPDATE_BANNER_IS_ENABLED && !dismissed,
    close: () => setDismissed(true),
  }
}

export function PolicyUpdateBanner() {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {visible, close} = usePolicyUpdateBannerState()

  if (!visible) return null

  const effectiveDate = i18n.date(POLICY_UPDATE_EFFECTIVE_DATE, {
    day: 'numeric',
    month: 'long',
  })

  return (
    <View
      style={[
        a.px_lg,
        a.py_md,
        a.border_b,
        t.atoms.border_contrast_low,
        t.atoms.bg_contrast_25,
      ]}>
      <View style={[a.flex_row, a.align_center, a.gap_md, {paddingRight: 32}]}>
        <CircleInfo size="lg" fill={t.palette.primary_500} />

        <View style={[a.flex_1]}>
          <Text style={[a.text_sm, a.leading_snug]}>
            <Trans>
              We’ve updated our{' '}
              <InlineLinkText
                label={l`Read the updated Privacy Policy`}
                key="privacy"
                to={webLinks.privacy}>
                Privacy Policy
              </InlineLinkText>{' '}
              and{' '}
              <InlineLinkText
                label={l`Read the updated Terms`}
                key="tos"
                to={webLinks.tos}>
                Terms
              </InlineLinkText>
              ; they take effect {effectiveDate}.
            </Trans>
          </Text>
        </View>
      </View>

      <Button
        label={l`Dismiss`}
        size="small"
        hitSlop={HITSLOP_10}
        onPress={close}
        style={[
          a.absolute,
          a.justify_center,
          a.align_center,
          {
            top: 0,
            bottom: 0,
            right: 0,
            paddingRight: a.px_md.paddingLeft,
          },
        ]}>
        <X width={20} fill={t.atoms.text_contrast_medium.color} />
      </Button>
    </View>
  )
}
