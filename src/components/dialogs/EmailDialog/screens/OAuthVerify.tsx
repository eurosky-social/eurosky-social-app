import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useOpenLink} from '#/lib/hooks/useOpenLink'
import {useSession} from '#/state/session'
import {usePdsAccountLink} from '#/screens/Settings/components/AccountFootprintDialog/usePdsAccountLink'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useOnEmailVerified} from '#/components/dialogs/EmailDialog/events'
import {VerifySuccess} from '#/components/dialogs/EmailDialog/screens/Verify'
import {
  type ScreenID,
  type ScreenProps,
} from '#/components/dialogs/EmailDialog/types'
import {SquareArrowTopRight_Stroke2_Corner0_Rounded as ExternalIcon} from '#/components/icons/SquareArrowTopRight'
import {Span, Text} from '#/components/Typography'

/**
 * Email verification for OAuth sessions. Their tokens can't authorise the
 * email endpoints (the PDS answers ScopeMissingError), so the user verifies on
 * the hosting provider's account page instead.
 */
export function OAuthVerify({
  config,
}: Pick<ScreenProps<ScreenID.Verify>, 'config'>) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {currentAccount} = useSession()
  const openLink = useOpenLink()
  const pdsAccountLink = usePdsAccountLink()
  const [isVerified, setIsVerified] = useState(false)

  useOnEmailVerified(() => {
    if (config.onVerify) {
      config.onVerify()
    } else {
      setIsVerified(true)
    }
  })

  if (isVerified) {
    return <VerifySuccess />
  }

  return (
    <View style={[a.gap_lg]}>
      <View style={[a.gap_sm]}>
        <Text style={[a.text_xl, a.font_bold]}>
          <Trans>Verify your email</Trans>
        </Text>

        {config.instructions?.map((int, i) => (
          <Text
            key={i}
            style={[
              a.italic,
              a.text_sm,
              a.leading_snug,
              t.atoms.text_contrast_medium,
            ]}>
            {int}
          </Text>
        ))}

        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Your email is managed by your hosting provider. To verify{' '}
            <Span style={[a.font_semi_bold, t.atoms.text]}>
              {currentAccount?.email}
            </Span>{' '}
            open your account page on {pdsAccountLink.host}, then come back
            here.
          </Trans>
        </Text>
      </View>
      <Button
        testID="oauthVerifyEmailVisitPdsButton"
        label={l`Verify on ${pdsAccountLink.host}`}
        size="large"
        color="primary"
        onPress={() => openLink(pdsAccountLink.url)}>
        <ButtonText numberOfLines={1} style={[a.flex_shrink]}>
          <Trans>Verify on {pdsAccountLink.host}</Trans>
        </ButtonText>
        <ButtonIcon icon={ExternalIcon} />
      </Button>
    </View>
  )
}
