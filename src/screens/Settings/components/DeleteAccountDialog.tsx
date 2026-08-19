import {useCallback, useRef, useState} from 'react'
import {type TextInput, View} from 'react-native'
import {type Client} from '@atproto/lex'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {timeout} from '#/lib/async/timeout'
import {useCleanError} from '#/lib/hooks/useCleanError'
import {createLexClient} from '#/lib/lexClient'
import {isNetworkError, shouldRetryError} from '#/lib/strings/errors'
import {sanitizeHandle} from '#/lib/strings/handles'
import {logger} from '#/logger'
import {usePdsClient, useSession, useSessionApi} from '#/state/session'
import {resolveDidServiceEndpoint} from '#/state/session/identity-resolver'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {type DialogOuterProps} from '#/components/Dialog'
import {
  isValidCode,
  TokenField,
} from '#/components/dialogs/EmailDialog/components/TokenField'
import * as TextField from '#/components/forms/TextField'
import {Envelope_Stroke2_Corner0_Rounded as Envelope} from '#/components/icons/Envelope'
import {Lock_Stroke2_Corner0_Rounded as Lock} from '#/components/icons/Lock'
import {createStaticClick, SimpleInlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import * as Prompt from '#/components/Prompt'
import * as toast from '#/components/Toast'
import {Span, Text} from '#/components/Typography'
import {BRAND} from '#/config/brand'
import {CHAT_PROXY_DID} from '#/env'
import {chat, com} from '#/lexicons'
import {resetToTab} from '#/Navigation'
import {OAuthAccountActionPasswordRequired} from './OAuthAccountActionPasswordRequired'

const WHITESPACE_RE = /\s/gu
const PASSWORD_MIN_LENGTH = 8
const CHAT_SERVICE_RESOLVE_TIMEOUT_MS = 5e3
const CHAT_DELETE_TIMEOUT_MS = 3e3
const CHAT_DELETE_ATTEMPTS = 3
const CHAT_DELETE_RETRY_DELAY_MS = 500

enum Step {
  SEND_CODE,
  VERIFY_CODE,
  CONFIRM_DELETION,
}

enum EmailState {
  DEFAULT,
  PENDING,
}

function isPasswordValid(password: string) {
  return password.length >= PASSWORD_MIN_LENGTH
}

async function resolveChatServiceEndpoint() {
  const controller = new AbortController()
  const timeoutId = setTimeout(
    () => controller.abort(),
    CHAT_SERVICE_RESOLVE_TIMEOUT_MS,
  )

  try {
    const endpoint = await resolveDidServiceEndpoint({
      did: CHAT_PROXY_DID,
      id: '#bsky_chat',
      type: 'BskyChatService',
      signal: controller.signal,
    })
    if (!endpoint) {
      throw new Error(
        `Chat service ${CHAT_PROXY_DID} has no #bsky_chat endpoint`,
      )
    }
    return endpoint
  } finally {
    clearTimeout(timeoutId)
  }
}

async function deleteChatAccountWithRetry(client: Client) {
  let lastError: unknown

  for (let attempt = 1; attempt <= CHAT_DELETE_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(
      () => controller.abort(),
      CHAT_DELETE_TIMEOUT_MS,
    )

    try {
      await client.call(chat.bsky.actor.deleteAccount, undefined, {
        signal: controller.signal,
      })
      return
    } catch (e) {
      lastError = e
      const canRetry =
        attempt < CHAT_DELETE_ATTEMPTS &&
        (isNetworkError(e) || shouldRetryError(e))
      if (!canRetry) throw e
      await timeout(CHAT_DELETE_RETRY_DELAY_MS)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  throw lastError
}

export function DeleteAccountDialog({
  control,
  deactivateDialogControl,
}: {
  control: DialogOuterProps['control']
  deactivateDialogControl: DialogOuterProps['control']
}) {
  const {currentAccount} = useSession()

  return (
    <Prompt.Outer control={control}>
      {currentAccount?.isOauthSession ? (
        <OAuthAccountActionPasswordRequired action="delete" />
      ) : (
        <DeleteAccountDialogInner
          control={control}
          deactivateDialogControl={deactivateDialogControl}
        />
      )}
    </Prompt.Outer>
  )
}

function DeleteAccountDialogInner({
  control,
  deactivateDialogControl,
}: {
  control: DialogOuterProps['control']
  deactivateDialogControl: DialogOuterProps['control']
}) {
  const passwordRef = useRef<TextInput | null>(null)
  const t = useTheme()
  const {_} = useLingui()
  const cleanError = useCleanError()
  const client = usePdsClient()
  const {currentAccount} = useSession()
  const {removeAccount} = useSessionApi()

  const [emailState, setEmailState] = useState(EmailState.DEFAULT)
  const [emailSentCount, setEmailSentCount] = useState(0)
  const [step, setStep] = useState(Step.SEND_CODE)
  const [confirmCode, setConfirmCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const sendEmail = useCallback(async () => {
    if (emailState === EmailState.PENDING) {
      return
    }
    try {
      setEmailState(EmailState.PENDING)
      await client.call(com.atproto.server.requestAccountDelete)
      setError('')
      setEmailSentCount(prevCount => prevCount + 1)
      setStep(Step.VERIFY_CODE)
    } catch (e: any) {
      const {clean, raw} = cleanError(e)
      const error = clean || raw || e
      setError(error)
      logger.error(raw || e, {
        message: 'Failed to send account deletion verification email',
      })
    } finally {
      setEmailState(EmailState.DEFAULT)
    }
  }, [client, cleanError, emailState, setEmailState])

  const confirmDeletion = useCallback(async () => {
    try {
      setError('')
      if (!currentAccount?.did) {
        throw new Error('Invalid did')
      }
      const token = confirmCode.replace(WHITESPACE_RE, '')
      /*
       * Resolve the configured chat DID and mint authorization while the PDS
       * account still exists, but do not delete the chat account until the PDS
       * has validated the password and deletion token. This prevents invalid
       * credentials or a failed PDS request from deleting only the chat account.
       */
      const chatServiceEndpoint = await resolveChatServiceEndpoint()
      const {token: chatDeletionToken} = await client.call(
        com.atproto.server.getServiceAuth,
        {
          aud: CHAT_PROXY_DID,
          lxm: chat.bsky.actor.deleteAccount.$nsid,
        },
      )
      const chatDeletionClient = createLexClient(
        {
          service: chatServiceEndpoint,
          headers: {authorization: `Bearer ${chatDeletionToken}`},
        },
        {appLabelers: null},
      )

      await client.call(com.atproto.server.deleteAccount, {
        did: currentAccount.did,
        password,
        token,
      })

      /*
       * The PDS account is now gone, so retry chat cleanup with strict per-call
       * timeouts. Local finalization belongs in `finally`: chat downtime must
       * never strand a deleted PDS account in the signed-in UI.
       */
      try {
        await deleteChatAccountWithRetry(chatDeletionClient)
      } catch (e) {
        logger.error('Failed to delete chat account after bounded retries', {
          safeMessage: e,
        })
      } finally {
        control.close(() => {
          toast.show(_(msg`Your account has been deleted, see ya! ✌️`))
          resetToTab('HomeTab')
          removeAccount(currentAccount)
        })
      }
    } catch (e: any) {
      const {clean, raw} = cleanError(e)
      const error = clean || raw || e
      setError(error)
      logger.error(raw || e, {
        message: 'Failed to delete account',
      })
      setConfirmCode('')
      setPassword('')
      setStep(Step.VERIFY_CODE)
    }
  }, [
    _,
    cleanError,
    client,
    confirmCode,
    control,
    currentAccount,
    password,
    removeAccount,
  ])

  const handleDeactivate = useCallback(() => {
    control.close(() => deactivateDialogControl.open())
  }, [control, deactivateDialogControl])

  const handleSendEmail = useCallback(() => {
    void sendEmail()
  }, [sendEmail])

  const handleSubmitConfirmCode = useCallback(() => {
    passwordRef.current?.focus()
  }, [])

  const handleDeleteAccount = useCallback(() => {
    setStep(Step.CONFIRM_DELETION)
  }, [setStep])

  const handleConfirmDeletion = useCallback(() => {
    void confirmDeletion()
  }, [confirmDeletion])

  const currentHandle = sanitizeHandle(currentAccount?.handle ?? '', '@')
  const currentEmail = currentAccount?.email ?? '(no email)'

  switch (step) {
    case Step.SEND_CODE:
      return (
        <>
          <Prompt.Content>
            <Prompt.TitleText>
              {_(msg`Delete account “${currentHandle}”`)}
            </Prompt.TitleText>
            <Prompt.DescriptionText>
              <Trans>
                For security reasons, we’ll need to send a confirmation code to
                your email address{' '}
                <Span style={[a.font_semi_bold, t.atoms.text]}>
                  {currentEmail}
                </Span>
                .
              </Trans>
            </Prompt.DescriptionText>
          </Prompt.Content>
          <Prompt.Actions>
            <Prompt.Action
              icon={emailState === EmailState.PENDING ? Loader : Envelope}
              cta={_(msg`Send email`)}
              shouldCloseOnPress={false}
              onPress={handleSendEmail}
            />
            <Prompt.Cancel />
          </Prompt.Actions>
          {error && (
            <Admonition style={[a.mt_lg]} type="error">
              <Text style={[a.flex_1, a.leading_snug]}>{error}</Text>
            </Admonition>
          )}
          <Admonition style={[a.mt_lg]} type="tip">
            <Trans>
              You can also{' '}
              <SimpleInlineLinkText
                label={_(msg`Temporarily deactivate your account`)}
                {...createStaticClick(handleDeactivate)}>
                temporarily deactivate
              </SimpleInlineLinkText>{' '}
              your account instead. Your profile, posts, feeds, and lists will
              no longer be visible to other Bluesky users. You can reactivate
              your account at any time by logging in.
            </Trans>
          </Admonition>
        </>
      )
    case Step.VERIFY_CODE:
      return (
        <>
          <Prompt.Content>
            <Prompt.TitleText>
              {_(msg`Delete account “${currentHandle}”`)}
            </Prompt.TitleText>
            <Prompt.DescriptionText>
              <Trans>
                Check{' '}
                <Span style={[a.font_semi_bold, t.atoms.text]}>
                  {currentEmail}
                </Span>{' '}
                for an email with the confirmation code to enter below:
              </Trans>
            </Prompt.DescriptionText>
          </Prompt.Content>
          <View style={[a.mb_xs]}>
            <TextField.LabelText>
              <Trans>Confirmation code</Trans>
            </TextField.LabelText>
            <TokenField
              value={confirmCode}
              onChangeText={setConfirmCode}
              onSubmitEditing={handleSubmitConfirmCode}
            />
          </View>
          <Text
            style={[
              a.text_sm,
              a.leading_snug,
              a.mb_lg,
              t.atoms.text_contrast_medium,
            ]}>
            {emailSentCount > 1 ? (
              <Trans>
                Email sent!{' '}
                <SimpleInlineLinkText
                  label={_(msg`Click here to resend the email`)}
                  {...createStaticClick(handleSendEmail)}>
                  Click here to resend.
                </SimpleInlineLinkText>
              </Trans>
            ) : (
              <Trans>
                Don’t see a code?{' '}
                <SimpleInlineLinkText
                  label={_(msg`Click here to resend the email`)}
                  {...createStaticClick(handleSendEmail)}>
                  Click here to resend.
                </SimpleInlineLinkText>
              </Trans>
            )}{' '}
            <Span style={{top: 1}}>
              {emailState === EmailState.PENDING ? <Loader size="xs" /> : null}
            </Span>
          </Text>
          <View style={[a.mb_xl]}>
            <TextField.LabelText>
              <Trans>Password</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Icon icon={Lock} />
              <TextField.Input
                inputRef={passwordRef}
                testID="newPasswordInput"
                label={_(msg`Enter your password`)}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                secureTextEntry={true}
                autoComplete="off"
                clearButtonMode="while-editing"
                passwordRules={`minlength: ${PASSWORD_MIN_LENGTH}};`}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleDeleteAccount}
              />
            </TextField.Root>
          </View>
          <Prompt.Actions>
            <Prompt.Action
              color="negative"
              disabled={!isValidCode(confirmCode) || !isPasswordValid(password)}
              cta={_(msg`Delete my account`)}
              shouldCloseOnPress={false}
              onPress={handleDeleteAccount}
            />
            <Prompt.Cancel />
          </Prompt.Actions>
          {error && (
            <Admonition style={[a.mt_lg]} type="error">
              <Text style={[a.flex_1, a.leading_snug]}>{error}</Text>
            </Admonition>
          )}
        </>
      )
    case Step.CONFIRM_DELETION:
      return (
        <>
          <Prompt.Content>
            <Prompt.TitleText>
              {_(msg`Are you really, really sure?`)}
            </Prompt.TitleText>
            <Prompt.DescriptionText>
              <Trans>
                This will irreversibly delete your Bluesky account{' '}
                <Span style={[a.font_semi_bold, t.atoms.text]}>
                  {currentHandle}
                </Span>{' '}
                and all associated data. Note that this will affect any other{' '}
                <SimpleInlineLinkText
                  to={BRAND.links.faq}
                  label={_(msg`AT Protocol FAQ`)}>
                  AT Protocol
                </SimpleInlineLinkText>{' '}
                services you use with this account.
              </Trans>
            </Prompt.DescriptionText>
          </Prompt.Content>
          <Prompt.Actions>
            <Prompt.Action
              color="negative"
              cta={_(msg`Yes, delete my account`)}
              shouldCloseOnPress={false}
              onPress={handleConfirmDeletion}
            />
            <Prompt.Cancel />
          </Prompt.Actions>
        </>
      )
  }
}
