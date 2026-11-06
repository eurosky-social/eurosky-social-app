import {useCallback, useState} from 'react'
import {View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {logger} from '#/logger'
import {usePdsClient, useSession, useSessionApi} from '#/state/session'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {type DialogOuterProps, useDialogControl} from '#/components/Dialog'
import {Divider} from '#/components/Divider'
import {CircleInfo_Stroke2_Corner0_Rounded as CircleInfo} from '#/components/icons/CircleInfo'
import {Loader} from '#/components/Loader'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'
import {com} from '#/lexicons'
import {AccountActionIdentity} from './AccountActionIdentity'
import {AccountActionIntro} from './AccountActionIntro'
import {AccountFootprintDialog} from './AccountFootprintDialog'

export function DeactivateAccountDialog({
  control,
}: {
  control: DialogOuterProps['control']
}) {
  const {currentAccount} = useSession()
  const footprintControl = useDialogControl()
  const isOauth = !!currentAccount?.isOauthSession
  /*
   * Deactivation starts from the account footprint. Confirming there reopens
   * this dialog with the real confirmation; closing it any other way starts
   * over.
   */
  const [hasReviewed, setHasReviewed] = useState(false)

  const onPressWhatWillILose = () => {
    control.close(() => footprintControl.open())
  }

  return (
    <>
      <Prompt.Outer control={control} onClose={() => setHasReviewed(false)}>
        {isOauth || !hasReviewed ? (
          <AccountActionIntro
            action="deactivate"
            onPressWhatWillILose={onPressWhatWillILose}
          />
        ) : (
          <DeactivateAccountDialogInner control={control} />
        )}
        <Dialog.Close />
      </Prompt.Outer>
      <AccountFootprintDialog
        control={footprintControl}
        action="deactivate"
        useHostingProvider={isOauth}
        onConfirm={() => {
          setHasReviewed(true)
          control.open()
        }}
      />
    </>
  )
}

function DeactivateAccountDialogInner({
  control,
}: {
  control: DialogOuterProps['control']
}) {
  const t = useTheme()
  const {_} = useLingui()
  const client = usePdsClient()
  const {logoutCurrentAccount} = useSessionApi()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const handleDeactivate = useCallback(async () => {
    try {
      setPending(true)
      await client.call(com.atproto.server.deactivateAccount, {})
      control.close(() => {
        logoutCurrentAccount('Deactivated')
      })
    } catch (e: any) {
      switch (e.message) {
        case 'Bad token scope':
          setError(
            _(
              msg`You're signed in with an App Password. Please sign in with your main password to continue deactivating your account.`,
            ),
          )
          break
        default:
          setError(_(msg`Something went wrong, please try again`))
          break
      }

      logger.error(e, {
        message: 'Failed to deactivate account',
      })
    }
    setPending(false)
  }, [client, control, logoutCurrentAccount, _, setPending])

  return (
    <>
      <Prompt.Content>
        <AccountActionIdentity />
        <Prompt.TitleText>
          <Trans>Deactivate your account</Trans>
        </Prompt.TitleText>
        <View style={[a.mt_xs]}>
          <Prompt.DescriptionText>
            <Trans>
              Your profile, posts, and everything else in your Atmosphere
              account will be hidden in every app. You can reactivate your
              account at any time by logging in.
            </Trans>
          </Prompt.DescriptionText>
        </View>
      </Prompt.Content>

      <View style={[a.pb_xl]}>
        <Divider />
        <View style={[a.gap_sm, a.pt_lg, a.pb_xl]}>
          <Text style={[t.atoms.text_contrast_medium, a.leading_snug]}>
            <Trans>
              There is no time limit for account deactivation, come back any
              time.
            </Trans>
          </Text>
          <Text style={[t.atoms.text_contrast_medium, a.leading_snug]}>
            <Trans>
              If you're trying to change your handle or email, do so before you
              deactivate.
            </Trans>
          </Text>
        </View>

        <Divider />
      </View>
      <Prompt.Actions>
        <Button
          color="negative"
          size="large"
          label={_(msg`Yes, deactivate`)}
          onPress={handleDeactivate}>
          <ButtonText>{_(msg`Yes, deactivate`)}</ButtonText>
          {pending && <ButtonIcon icon={Loader} position="right" />}
        </Button>
        <Prompt.Cancel />
      </Prompt.Actions>

      {error && (
        <View
          style={[
            a.flex_row,
            a.gap_sm,
            a.mt_md,
            a.p_md,
            a.rounded_sm,
            t.atoms.bg_contrast_25,
          ]}>
          <CircleInfo size="md" fill={t.palette.negative_400} />
          <Text style={[a.flex_1, a.leading_snug]}>{error}</Text>
        </View>
      )}
    </>
  )
}
