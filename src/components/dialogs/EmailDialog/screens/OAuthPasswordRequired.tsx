import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useSessionApi} from '#/state/session'
import {atoms as a} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import {useDialogContext} from '#/components/Dialog'
import {Text} from '#/components/Typography'

export function OAuthPasswordRequired({
  action,
}: {
  action: 'changeEmail' | 'manageEmail2FA'
}) {
  const {t: l} = useLingui()
  const {logoutCurrentAccount} = useSessionApi()
  const control = useDialogContext()
  const isChangingEmail = action === 'changeEmail'

  return (
    <View style={[a.gap_lg]}>
      <Text style={[a.text_xl, a.font_bold, a.leading_snug]}>
        {isChangingEmail ? (
          <Trans>Sign in with your password to change your email</Trans>
        ) : (
          <Trans>Sign in with your password to manage email 2FA</Trans>
        )}
      </Text>
      <Admonition type="info">
        {isChangingEmail ? (
          <Trans>
            You're signed in via your hosting provider (OAuth). Changing your
            email address isn't supported for OAuth sign-ins. Log out, choose
            “Sign in with password” on the sign-in screen, and use your main
            account password.
          </Trans>
        ) : (
          <Trans>
            You're signed in via your hosting provider (OAuth). Managing email
            2FA isn't supported for OAuth sign-ins. Log out, choose “Sign in
            with password” on the sign-in screen, and use your main account
            password.
          </Trans>
        )}
      </Admonition>
      <Button
        testID={
          isChangingEmail
            ? 'oauthChangeEmailLogoutButton'
            : 'oauthEmail2FALogoutButton'
        }
        label={l`Log out`}
        accessibilityHint={l`Logs out so you can sign in with your password`}
        variant="solid"
        color="primary"
        size="large"
        onPress={() => {
          control.close(() => logoutCurrentAccount('Settings'))
        }}>
        <ButtonText>
          <Trans>Log out</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
