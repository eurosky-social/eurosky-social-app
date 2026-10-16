import {useCallback, useMemo, useState} from 'react'
import {ScrollView, View} from 'react-native'
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from 'react-native-reanimated'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'
import {useMutation, useQueryClient} from '@tanstack/react-query'

import {ensureMarqueAtprotoRecord} from '#/lib/api/marque'
import {HITSLOP_10, urls} from '#/lib/constants'
import {cleanError} from '#/lib/strings/errors'
import {
  createFullHandle,
  sanitizeHandle,
  validateServiceHandle,
} from '#/lib/strings/handles'
import {logger} from '#/logger'
import {useFetchDid, useUpdateHandleMutation} from '#/state/queries/handle'
import {useMarqueDomainsQuery} from '#/state/queries/marque'
import {RQKEY as RQKEY_PROFILE} from '#/state/queries/profile'
import {useServiceQuery} from '#/state/queries/service'
import {useCurrentAccountProfile} from '#/state/queries/useCurrentAccountProfile'
import {usePdsClient, useSession, useSessionApi} from '#/state/session'
import {oauthUpgradeForHandle} from '#/state/session/oauth-web-client'
import {ErrorScreen} from '#/view/com/util/error/ErrorScreen'
import {atoms as a, native, useBreakpoints, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as TextField from '#/components/forms/TextField'
import {
  ArrowLeft_Stroke2_Corner0_Rounded as ArrowLeftIcon,
  ArrowRight_Stroke2_Corner0_Rounded as ArrowRightIcon,
} from '#/components/icons/Arrow'
import {At_Stroke2_Corner0_Rounded as AtIcon} from '#/components/icons/At'
import {CheckThick_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import {SquareBehindSquare4_Stroke2_Corner0_Rounded as CopyIcon} from '#/components/icons/SquareBehindSquare4'
import {InlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {useSimpleVerificationState} from '#/components/verification'
import {type com} from '#/lexicons'
import {BuyDomainFlow, hasPendingDomainCheckout} from './BuyDomainDialog'
import {CopyButton} from './CopyButton'

export function ChangeHandleDialog({
  control,
}: {
  control: Dialog.DialogControlProps
}) {
  return (
    <Dialog.Outer control={control} nativeOptions={{fullHeight: true}}>
      <ChangeHandleDialogInner />
    </Dialog.Outer>
  )
}

function ChangeHandleDialogInner() {
  const control = Dialog.useDialogContext()
  const {_} = useLingui()
  const {currentAccount} = useSession()
  /*
   * currentAccount.service is the correct describeServer target for both
   * password sessions and OAuth sessions.
   */
  const {
    data: serviceInfo,
    error: serviceInfoError,
    refetch,
  } = useServiceQuery(currentAccount?.service ?? '')

  const [page, setPage] = useState<
    'provided-handle' | 'own-handle' | 'buy-domain'
  >(hasPendingDomainCheckout() ? 'buy-domain' : 'provided-handle')

  const leftButton = useCallback(
    () => (
      <Button
        label={page === 'buy-domain' ? _(msg`Back`) : _(msg`Cancel`)}
        onPress={() =>
          page === 'buy-domain' ? setPage('provided-handle') : control.close()
        }
        size="small"
        color="primary"
        variant="ghost"
        style={[a.rounded_full]}>
        {page === 'buy-domain' && (
          <ButtonIcon icon={ArrowLeftIcon} position="left" />
        )}
        <ButtonText style={[a.text_md]}>
          {page === 'buy-domain' ? <Trans>Back</Trans> : <Trans>Cancel</Trans>}
        </ButtonText>
      </Button>
    ),
    [control, page, _],
  )

  return (
    <Dialog.ScrollableInner
      label={
        page === 'buy-domain' ? _(msg`Buy a domain`) : _(msg`Change Handle`)
      }
      header={
        <Dialog.Header renderLeft={leftButton}>
          <Dialog.HeaderText>
            {page === 'buy-domain' ? (
              <Trans>Buy a domain</Trans>
            ) : (
              <Trans>Change Handle</Trans>
            )}
          </Dialog.HeaderText>
        </Dialog.Header>
      }
      contentContainerStyle={[a.pt_0, a.px_0]}>
      <View style={[a.flex_1, a.pt_lg, a.px_xl]}>
        {page === 'buy-domain' ? (
          <BuyDomainFlow />
        ) : serviceInfoError ? (
          <ErrorScreen
            title={_(msg`Oops!`)}
            message={_(msg`There was an issue fetching your service info`)}
            details={cleanError(serviceInfoError)}
            onPressTryAgain={() => void refetch()}
          />
        ) : serviceInfo ? (
          <LayoutAnimationConfig skipEntering skipExiting>
            {page === 'provided-handle' ? (
              <Animated.View
                key={page}
                entering={native(SlideInLeft)}
                exiting={native(SlideOutLeft)}>
                <ProvidedHandlePage
                  serviceInfo={serviceInfo}
                  goToOwnHandle={() => setPage('own-handle')}
                  goToBuyDomain={() => setPage('buy-domain')}
                />
              </Animated.View>
            ) : (
              <Animated.View
                key={page}
                entering={native(SlideInRight)}
                exiting={native(SlideOutRight)}>
                <OwnHandlePage
                  goToServiceHandle={() => setPage('provided-handle')}
                />
              </Animated.View>
            )}
          </LayoutAnimationConfig>
        ) : (
          <View style={[a.flex_1, a.justify_center, a.align_center, a.py_4xl]}>
            <Loader size="xl" />
          </View>
        )}
      </View>
    </Dialog.ScrollableInner>
  )
}

/**
 * Re-authorization prompt shown when a handle change fails in a way that looks
 * like missing permission. Initial logins request transitional scope only (some
 * PDSes reject transitional + granular together), so updateHandle's
 * `identity:handle` grant is acquired on demand via a re-authorization step-up.
 */
function ChangeHandleScopeUpgrade() {
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [redirectError, setRedirectError] = useState<string | undefined>(
    undefined,
  )

  const onUpgrade = async () => {
    if (!currentAccount?.did) return
    setRedirectError(undefined)
    setIsRedirecting(true)
    try {
      // On success the page redirects away and this never resolves; it only
      // settles by rejecting when the server refuses the granular scope.
      await oauthUpgradeForHandle(currentAccount.did)
    } catch (e) {
      setIsRedirecting(false)
      setRedirectError(
        _(
          msg`Your server does not support changing your handle from this app.`,
        ),
      )
      logger.error('handle step-up: authorize failed', {
        safeMessage: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return (
    <View style={[a.gap_md]}>
      {redirectError ? (
        <Admonition type="error">{redirectError}</Admonition>
      ) : (
        <Admonition type="warning">
          <Trans>
            Couldn’t change your handle. Your session may need an extra
            permission from your server to do this.
          </Trans>
        </Admonition>
      )}
      <Text style={[a.text_md, a.leading_snug]}>
        <Trans>
          You’ll be sent to your server to approve the permission, then brought
          back here to try again.
        </Trans>
      </Text>
      <Button
        label={_(msg`Continue`)}
        variant="solid"
        color="primary"
        size="large"
        disabled={isRedirecting}
        onPress={() => void onUpgrade()}>
        {isRedirecting ? (
          <ButtonIcon icon={Loader} />
        ) : (
          <ButtonText>
            <Trans>Continue</Trans>
          </ButtonText>
        )}
      </Button>
    </View>
  )
}

/**
 * Handle-change errors that are normal validation failures (not a permission
 * problem). Used to decide whether a failure should offer the scope upgrade.
 */
function isBenignHandleValidationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const m = error.message
  return (
    m.startsWith('Handle already taken') ||
    m === 'Reserved handle' ||
    m === 'Handle too long' ||
    m === 'Input/handle must be a valid handle' ||
    m === 'Rate Limit Exceeded'
  )
}

function ProvidedHandlePage({
  serviceInfo,
  goToOwnHandle,
  goToBuyDomain,
}: {
  serviceInfo: com.atproto.server.describeServer.$OutputBody
  goToOwnHandle: () => void
  goToBuyDomain: () => void
}) {
  const {_} = useLingui()
  const [subdomain, setSubdomain] = useState('')
  const control = Dialog.useDialogContext()
  const {currentAccount} = useSession()
  const {partialRefreshSession} = useSessionApi()
  const queryClient = useQueryClient()
  const profile = useCurrentAccountProfile()
  const verification = useSimpleVerificationState({
    profile,
  })

  const {
    mutate: changeHandle,
    isPending,
    error,
    isSuccess,
  } = useUpdateHandleMutation({
    onSuccess: () => {
      if (currentAccount) {
        queryClient.invalidateQueries({
          queryKey: RQKEY_PROFILE(currentAccount.did),
        })
      }
      // OAuth tokens live outside the password-session store; refresh account
      // metadata directly so the new handle appears for either session type.
      partialRefreshSession().then(() => control.close())
    },
  })

  const host = serviceInfo.availableUserDomains[0]

  const validation = useMemo(
    () => validateServiceHandle(subdomain, host),
    [subdomain, host],
  )

  const isInvalid =
    !validation.handleChars ||
    !validation.hyphenStartOrEnd ||
    !validation.totalLength

  // A failure that looks like missing permission replaces the whole form with
  // the scope-upgrade prompt - retrying the form would just fail again.
  if (
    error &&
    currentAccount?.isOauthSession &&
    !isBenignHandleValidationError(error)
  ) {
    return <ChangeHandleScopeUpgrade />
  }

  return (
    <LayoutAnimationConfig skipEntering>
      <View style={[a.flex_1, a.gap_md]}>
        {isSuccess && (
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <SuccessMessage text={_(msg`Handle changed!`)} />
          </Animated.View>
        )}
        {error && (
          <Animated.View entering={FadeIn} exiting={FadeOut}>
            <ChangeHandleError error={error} />
          </Animated.View>
        )}
        <Animated.View
          layout={native(LinearTransition)}
          style={[a.flex_1, a.gap_md]}>
          {verification.isVerified && verification.role === 'default' && (
            <Admonition type="error">
              <Trans>
                You are verified. You will lose your verification status if you
                change your handle.{' '}
                <InlineLinkText
                  label={_(
                    msg({
                      message: `Learn more`,
                      context: `english-only-resource`,
                    }),
                  )}
                  to={urls.website.blog.initialVerificationAnnouncement}>
                  <Trans context="english-only-resource">Learn more.</Trans>
                </InlineLinkText>
              </Trans>
            </Admonition>
          )}
          <View>
            <TextField.LabelText>
              <Trans>New handle</Trans>
            </TextField.LabelText>
            <TextField.Root isInvalid={isInvalid}>
              <TextField.Icon icon={AtIcon} />
              <Dialog.Input
                editable={!isPending}
                defaultValue={subdomain}
                onChangeText={text => setSubdomain(text)}
                label={_(msg`New handle`)}
                placeholder={_(msg`e.g. alice`)}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextField.SuffixText label={host} style={[{maxWidth: '40%'}]}>
                {host}
              </TextField.SuffixText>
            </TextField.Root>
          </View>
          <Text>
            <Trans>
              Your full handle will be{' '}
              <Text style={[a.font_semi_bold]}>
                @{createFullHandle(subdomain, host)}
              </Text>
            </Trans>
          </Text>
          <Button
            label={_(msg`Save new handle`)}
            variant="solid"
            size="large"
            color={validation.overall ? 'primary' : 'secondary'}
            disabled={!validation.overall}
            onPress={() => {
              if (validation.overall) {
                changeHandle({handle: createFullHandle(subdomain, host)})
              }
            }}>
            {isPending ? (
              <ButtonIcon icon={Loader} />
            ) : (
              <ButtonText>
                <Trans>Save</Trans>
              </ButtonText>
            )}
          </Button>
          <Text style={[a.leading_snug]}>
            <Trans>
              If you have your own domain, you can use that as your handle. This
              lets you self-verify your identity.{' '}
              <InlineLinkText
                label={_(
                  msg({
                    message: `Learn more`,
                    context: `english-only-resource`,
                  }),
                )}
                to="https://bsky.social/about/blog/4-28-2023-domain-handle-tutorial"
                style={[a.font_semi_bold]}
                disableMismatchWarning>
                Learn more here.
              </InlineLinkText>
            </Trans>
          </Text>
          <Button
            label={_(msg`I have my own domain`)}
            variant="outline"
            color="primary"
            size="large"
            onPress={goToOwnHandle}>
            <ButtonText>
              <Trans>I have my own domain</Trans>
            </ButtonText>
            <ButtonIcon icon={ArrowRightIcon} position="right" />
          </Button>
          <Button
            label={_(msg`Buy a domain`)}
            variant="outline"
            color="primary"
            size="large"
            onPress={goToBuyDomain}>
            <ButtonText>
              <Trans>Buy a domain</Trans>
            </ButtonText>
            <ButtonIcon icon={ArrowRightIcon} position="right" />
          </Button>
        </Animated.View>
      </View>
    </LayoutAnimationConfig>
  )
}

function OwnHandlePage({goToServiceHandle}: {goToServiceHandle: () => void}) {
  const {_} = useLingui()
  const t = useTheme()
  const {currentAccount} = useSession()
  const [verificationMethod, setVerificationMethod] = useState<
    'dns' | 'file' | 'marque'
  >('dns')
  const [selectedMarqueDomain, setSelectedMarqueDomain] = useState('')
  const [marqueSubdomain, setMarqueSubdomain] = useState('')
  const [manualDomain, setManualDomain] = useState('')
  const [domain, setDomain] = useState('')
  const control = Dialog.useDialogContext()
  const {partialRefreshSession} = useSessionApi()
  const pdsClient = usePdsClient()
  const fetchDid = useFetchDid()
  const queryClient = useQueryClient()
  const {data: marqueDomains = []} = useMarqueDomainsQuery()

  const normalizedMarqueSubdomain = marqueSubdomain
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, '')
  const marqueHandle = selectedMarqueDomain
    ? normalizedMarqueSubdomain
      ? `${normalizedMarqueSubdomain}.${selectedMarqueDomain}`
      : selectedMarqueDomain
    : ''
  const isMarqueSubdomainValid =
    !normalizedMarqueSubdomain ||
    (marqueHandle.length <= 253 &&
      normalizedMarqueSubdomain.split('.').every(label => {
        return (
          label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
        )
      }))

  const {
    mutate: changeHandle,
    isPending,
    error,
    isSuccess,
  } = useUpdateHandleMutation({
    onSuccess: () => {
      if (currentAccount) {
        queryClient.invalidateQueries({
          queryKey: RQKEY_PROFILE(currentAccount.did),
        })
      }
      // See ProvidedHandlePage: this refresh path also supports OAuth.
      partialRefreshSession().then(() => control.close())
    },
  })

  const {
    mutate: verify,
    isPending: isVerifyPending,
    isSuccess: isVerified,
    error: verifyError,
    reset: resetVerification,
  } = useMutation<true, Error | DidMismatchError>({
    mutationKey: ['verify-handle', domain],
    mutationFn: async () => {
      if (!currentAccount?.did) throw new Error('Not authenticated')
      const marqueResult = await ensureMarqueAtprotoRecord(
        pdsClient,
        currentAccount.did,
        domain,
      )
      if (marqueResult === 'conflict') throw new MarqueDnsConflictError()

      const attempts = marqueResult === 'created' ? 5 : 1
      let lastError: unknown
      for (let attempt = 0; attempt < attempts; attempt++) {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000))
        }
        try {
          const did = await fetchDid(domain)
          if (did !== currentAccount.did) throw new DidMismatchError(did)
          return true
        } catch (error) {
          lastError = error
        }
      }
      throw lastError
    },
  })

  // A failure that looks like missing permission replaces the whole form with
  // the scope-upgrade prompt - retrying the form would just fail again.
  if (
    error &&
    currentAccount?.isOauthSession &&
    !isBenignHandleValidationError(error)
  ) {
    return <ChangeHandleScopeUpgrade />
  }

  return (
    <View style={[a.flex_1, a.gap_lg]}>
      {isSuccess && (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <SuccessMessage text={_(msg`Handle changed!`)} />
        </Animated.View>
      )}
      {error && (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <ChangeHandleError error={error} />
        </Animated.View>
      )}
      {verifyError && (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <Admonition type="error">
            {verifyError instanceof MarqueDnsConflictError ? (
              <Trans>
                This Marque domain already has an AT Protocol DNS record for a
                different account. Manage its DNS records in Marque before
                trying again.
              </Trans>
            ) : verifyError instanceof DidMismatchError ? (
              <Trans>
                Wrong DID returned from server. Received: {verifyError.did}
              </Trans>
            ) : (
              <Trans>Failed to verify handle. Please try again.</Trans>
            )}
          </Admonition>
        </Animated.View>
      )}
      <Animated.View
        layout={native(LinearTransition)}
        style={[a.flex_1, a.gap_md, a.overflow_hidden]}>
        {verificationMethod !== 'marque' ? (
          <View>
            <TextField.LabelText>
              <Trans>Enter the domain you want to use</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Icon icon={AtIcon} />
              <Dialog.Input
                label={_(msg`New handle`)}
                placeholder={_(msg`e.g. alice.com`)}
                editable={!isPending}
                defaultValue={manualDomain}
                onChangeText={text => {
                  setManualDomain(text)
                  setDomain(text)
                  resetVerification()
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </TextField.Root>
          </View>
        ) : (
          <View style={[a.gap_sm]}>
            <TextField.LabelText>
              <Trans>Enter the domain you want to use</Trans>
            </TextField.LabelText>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>Choose one of your Marque domains</Trans>
            </Text>
            <ScrollView
              style={[{maxHeight: 190}]}
              contentContainerStyle={[a.gap_xs]}
              keyboardShouldPersistTaps="handled">
              {marqueDomains.map(item => {
                const selected = selectedMarqueDomain === item.domain
                return (
                  <Button
                    key={item.domain}
                    label={_(msg`Use ${item.domain}`)}
                    variant="outline"
                    color={selected ? 'primary' : 'secondary'}
                    size="small"
                    shape="rectangular"
                    onPress={() => {
                      setSelectedMarqueDomain(item.domain)
                      setDomain(
                        normalizedMarqueSubdomain
                          ? `${normalizedMarqueSubdomain}.${item.domain}`
                          : item.domain,
                      )
                      resetVerification()
                    }}
                    style={[
                      a.w_full,
                      selected && {backgroundColor: t.palette.primary_50},
                    ]}>
                    <View
                      style={[
                        a.flex_row,
                        a.flex_1,
                        a.align_center,
                        a.justify_between,
                        a.gap_sm,
                      ]}>
                      <Text style={[a.text_md, a.font_semi_bold]}>
                        {item.domain}
                      </Text>
                      {selected && (
                        <CheckIcon fill={t.palette.primary_500} size="xs" />
                      )}
                    </View>
                  </Button>
                )
              })}
            </ScrollView>
            {selectedMarqueDomain && (
              <View style={[a.mt_sm]}>
                <TextField.LabelText>
                  <Trans>Add a subdomain (optional)</Trans>
                </TextField.LabelText>
                <TextField.Root isInvalid={!isMarqueSubdomainValid}>
                  <TextField.Icon icon={AtIcon} />
                  <Dialog.Input
                    label={_(msg`Marque subdomain`)}
                    placeholder={_(msg`Leave blank to use the root domain`)}
                    defaultValue={marqueSubdomain}
                    onChangeText={value => {
                      setMarqueSubdomain(value)
                      const normalized = value
                        .trim()
                        .toLowerCase()
                        .replace(/^\.+|\.+$/g, '')
                      setDomain(
                        normalized
                          ? `${normalized}.${selectedMarqueDomain}`
                          : selectedMarqueDomain,
                      )
                      resetVerification()
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TextField.SuffixText
                    label={`.${selectedMarqueDomain}`}
                    style={[{maxWidth: '45%'}]}>
                    .{selectedMarqueDomain}
                  </TextField.SuffixText>
                </TextField.Root>
              </View>
            )}
            {!isMarqueSubdomainValid && (
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>
                  Use letters, numbers, hyphens, or dots. Labels can’t start or
                  end with a hyphen.
                </Trans>
              </Text>
            )}
            {marqueHandle && (
              <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                <Trans>
                  Your handle will be{' '}
                  <Text style={[a.font_semi_bold]}>@{marqueHandle}</Text>
                </Trans>
              </Text>
            )}
          </View>
        )}
        <SegmentedControl.Root
          label={_(msg`Choose domain verification method`)}
          type="tabs"
          value={verificationMethod}
          onChange={value => {
            setVerificationMethod(value)
            setDomain(value === 'marque' ? marqueHandle : manualDomain)
            resetVerification()
          }}>
          <SegmentedControl.Item value="dns" label={_(msg`DNS Panel`)}>
            <SegmentedControl.ItemText>
              <Trans>DNS Panel</Trans>
            </SegmentedControl.ItemText>
          </SegmentedControl.Item>
          <SegmentedControl.Item value="file" label={_(msg`No DNS Panel`)}>
            <SegmentedControl.ItemText>
              <Trans>No DNS Panel</Trans>
            </SegmentedControl.ItemText>
          </SegmentedControl.Item>
          {marqueDomains.length > 0 && (
            <SegmentedControl.Item value="marque" label="Marque">
              <SegmentedControl.ItemText>Marque</SegmentedControl.ItemText>
            </SegmentedControl.Item>
          )}
        </SegmentedControl.Root>
        {verificationMethod === 'dns' ? (
          <>
            <Text>
              <Trans>Add the following DNS record to your domain:</Trans>
            </Text>
            <View
              style={[
                t.atoms.bg_contrast_25,
                a.rounded_sm,
                a.p_md,
                a.border,
                t.atoms.border_contrast_low,
              ]}>
              <Text style={[t.atoms.text_contrast_medium]}>
                <Trans>Host:</Trans>
              </Text>
              <View style={[a.py_xs]}>
                <CopyButton
                  color="secondary"
                  value="_atproto"
                  label={_(msg`Copy host`)}
                  style={[a.bg_transparent]}
                  hoverStyle={[a.bg_transparent]}
                  hitSlop={HITSLOP_10}>
                  <Text style={[a.text_md, a.flex_1]}>_atproto</Text>
                  <ButtonIcon icon={CopyIcon} />
                </CopyButton>
              </View>
              <Text style={[a.mt_xs, t.atoms.text_contrast_medium]}>
                <Trans>Type:</Trans>
              </Text>
              <View style={[a.py_xs]}>
                <Text style={[a.text_md]}>TXT</Text>
              </View>
              <Text style={[a.mt_xs, t.atoms.text_contrast_medium]}>
                <Trans>Value:</Trans>
              </Text>
              <View style={[a.py_xs]}>
                <CopyButton
                  color="secondary"
                  value={'did=' + currentAccount?.did}
                  label={_(msg`Copy TXT record value`)}
                  style={[a.bg_transparent]}
                  hoverStyle={[a.bg_transparent]}
                  hitSlop={HITSLOP_10}>
                  <Text style={[a.text_md, a.flex_1]}>
                    did={currentAccount?.did}
                  </Text>
                  <ButtonIcon icon={CopyIcon} />
                </CopyButton>
              </View>
            </View>
            <Text>
              <Trans>This should create a domain record at:</Trans>
            </Text>
            <View
              style={[
                t.atoms.bg_contrast_25,
                a.rounded_sm,
                a.p_md,
                a.border,
                t.atoms.border_contrast_low,
              ]}>
              <Text style={[a.text_md]}>_atproto.{domain}</Text>
            </View>
          </>
        ) : verificationMethod === 'file' ? (
          <>
            <Text>
              <Trans>Upload a text file to:</Trans>
            </Text>
            <View
              style={[
                t.atoms.bg_contrast_25,
                a.rounded_sm,
                a.p_md,
                a.border,
                t.atoms.border_contrast_low,
              ]}>
              <Text style={[a.text_md]}>
                https://{domain}/.well-known/atproto-did
              </Text>
            </View>
            <Text>
              <Trans>That contains the following:</Trans>
            </Text>
            <CopyButton
              value={currentAccount?.did ?? ''}
              label={_(msg`Copy DID`)}
              size="large"
              shape="rectangular"
              color="secondary"
              style={[
                a.px_md,
                a.border,
                t.atoms.border_contrast_low,
                t.atoms.bg_contrast_25,
              ]}>
              <Text style={[a.text_md, a.flex_1]}>{currentAccount?.did}</Text>
              <ButtonIcon icon={CopyIcon} />
            </CopyButton>
          </>
        ) : (
          <Text>
            <Trans>
              We’ll add the AT Protocol DNS record to this Marque domain for
              you.
            </Trans>
          </Text>
        )}
      </Animated.View>
      {isVerified && (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          layout={native(LinearTransition)}>
          <SuccessMessage text={_(msg`Domain verified!`)} />
        </Animated.View>
      )}
      <Animated.View layout={native(LinearTransition)}>
        {currentAccount?.handle?.endsWith('.bsky.social') && (
          <Admonition type="info" style={[a.mb_md]}>
            <Trans>
              Your current handle{' '}
              <Text style={[a.font_semi_bold]}>
                {sanitizeHandle(currentAccount?.handle || '', '@')}
              </Text>{' '}
              will automatically remain reserved for you. You can switch back to
              it at any time from this account.
            </Trans>
          </Admonition>
        )}
        <Button
          label={
            isVerified
              ? _(msg`Update to ${domain}`)
              : verificationMethod === 'dns'
                ? _(msg`Verify DNS Record`)
                : verificationMethod === 'file'
                  ? _(msg`Verify Text File`)
                  : _(msg`Configure Marque domain`)
          }
          variant="solid"
          size="large"
          color="primary"
          disabled={
            domain.trim().length === 0 ||
            (verificationMethod === 'marque' && !isMarqueSubdomainValid)
          }
          onPress={() => {
            if (isVerified) {
              changeHandle({handle: domain})
            } else {
              verify()
            }
          }}>
          {isPending || isVerifyPending ? (
            <ButtonIcon icon={Loader} />
          ) : (
            <ButtonText>
              {isVerified ? (
                <Trans>Update to {domain}</Trans>
              ) : verificationMethod === 'dns' ? (
                <Trans>Verify DNS Record</Trans>
              ) : verificationMethod === 'file' ? (
                <Trans>Verify Text File</Trans>
              ) : (
                <Trans>Configure domain</Trans>
              )}
            </ButtonText>
          )}
        </Button>

        <Button
          label={_(msg`Use default provider`)}
          accessibilityHint={_(msg`Returns to previous page`)}
          onPress={goToServiceHandle}
          variant="outline"
          color="secondary"
          size="large"
          style={[a.mt_sm]}>
          <ButtonIcon icon={ArrowLeftIcon} position="left" />
          <ButtonText>
            <Trans>Nevermind, create a handle for me</Trans>
          </ButtonText>
        </Button>
      </Animated.View>
    </View>
  )
}

class DidMismatchError extends Error {
  did: string
  constructor(did: string) {
    super('DID mismatch')
    this.name = 'DidMismatchError'
    this.did = did
  }
}

class MarqueDnsConflictError extends Error {
  constructor() {
    super('Conflicting Marque AT Protocol DNS record')
    this.name = 'MarqueDnsConflictError'
  }
}

function ChangeHandleError({error}: {error: unknown}) {
  const {_} = useLingui()

  let message = _(msg`Failed to change handle. Please try again.`)

  if (error instanceof Error) {
    if (error.message.startsWith('Handle already taken')) {
      message = _(msg`Handle already taken. Please try a different one.`)
    } else if (error.message === 'Reserved handle') {
      message = _(msg`This handle is reserved. Please try a different one.`)
    } else if (error.message === 'Handle too long') {
      message = _(msg`Handle too long. Please try a shorter one.`)
    } else if (error.message === 'Input/handle must be a valid handle') {
      message = _(msg`Invalid handle. Please try a different one.`)
    } else if (error.message === 'Rate Limit Exceeded') {
      message = _(
        msg`Rate limit exceeded – you've tried to change your handle too many times in a short period. Please wait a minute before trying again.`,
      )
    }
  }

  return <Admonition type="error">{message}</Admonition>
}

function SuccessMessage({text}: {text: string}) {
  const {gtMobile} = useBreakpoints()
  const t = useTheme()
  return (
    <View
      style={[
        a.flex_1,
        a.gap_md,
        a.flex_row,
        a.justify_center,
        a.align_center,
        gtMobile ? a.px_md : a.px_sm,
        a.py_xs,
        t.atoms.border_contrast_low,
      ]}>
      <View
        style={[
          {height: 20, width: 20},
          a.rounded_full,
          a.align_center,
          a.justify_center,
          {backgroundColor: t.palette.positive_500},
        ]}>
        <CheckIcon fill={t.palette.white} size="xs" />
      </View>
      <Text style={[a.text_md]}>{text}</Text>
    </View>
  )
}
