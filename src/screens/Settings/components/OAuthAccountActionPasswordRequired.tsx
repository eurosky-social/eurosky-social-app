import {Trans, useLingui} from '@lingui/react/macro'

import {useSessionApi} from '#/state/session'
import {atoms as a} from '#/alf'
import {Admonition} from '#/components/Admonition'
import * as Prompt from '#/components/Prompt'

export function OAuthAccountActionPasswordRequired({
  action,
}: {
  action: 'deactivate' | 'delete'
}) {
  const {t: l} = useLingui()
  const {logoutCurrentAccount} = useSessionApi()
  const isDeletion = action === 'delete'

  return (
    <>
      <Prompt.Content>
        <Prompt.TitleText>
          {isDeletion ? (
            <Trans>Sign in with your password to delete your account</Trans>
          ) : (
            <Trans>Sign in with your password to deactivate your account</Trans>
          )}
        </Prompt.TitleText>
        <Admonition style={[a.mt_lg]} type="info">
          {isDeletion ? (
            <Trans>
              You’re signed in via your hosting provider (OAuth). Account
              deletion isn’t supported for OAuth sign-ins. Log out, choose “Sign
              in with password” on the sign-in screen, and use your main account
              password.
            </Trans>
          ) : (
            <Trans>
              You’re signed in via your hosting provider (OAuth). Account
              deactivation isn’t supported for OAuth sign-ins. Log out, choose
              “Sign in with password” on the sign-in screen, and use your main
              account password.
            </Trans>
          )}
        </Admonition>
      </Prompt.Content>
      <Prompt.Actions>
        <Prompt.Action
          testID={
            isDeletion
              ? 'oauthDeleteAccountLogoutButton'
              : 'oauthDeactivateAccountLogoutButton'
          }
          cta={l`Log out`}
          onPress={() => logoutCurrentAccount('Settings')}
        />
        <Prompt.Cancel />
      </Prompt.Actions>
    </>
  )
}
