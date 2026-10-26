import {useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'
import {useQueryClient} from '@tanstack/react-query'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {getErrorName, getErrorStatus} from '#/lib/xrpc-error'
import {logger} from '#/logger'
import {useAppviewClient, useSession} from '#/state/session'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {FormError} from '#/components/forms/FormError'
import * as Toggle from '#/components/forms/Toggle'
import {ArrowBoxRight_Stroke2_Corner3_Rounded as TransferIcon} from '#/components/icons/ArrowBoxRight'
import {ArrowRotateClockwise_Stroke2_Corner0_Rounded as ProgressIcon} from '#/components/icons/ArrowRotate'
import {BulletList_Stroke2_Corner0_Rounded as ListIcon} from '#/components/icons/BulletList'
import {Check_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/Check'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'
import {
  APP_VIEW_PRESETS,
  AppViewValidationError,
  getAppViewOptionId,
  resolveCustomAppView,
} from '#/features/appView/config'
import {type AppViewPreference} from '#/features/appView/types'
import {
  createTransferCheckpoint,
  runAppViewTransfer,
} from '#/features/appViewTransfer/transfer'
import {
  APP_VIEW_TRANSFER_COLLECTIONS,
  type AppViewTransferCheckpoint,
  type AppViewTransferCollectionId,
  type AppViewTransferCollectionProgress,
} from '#/features/appViewTransfer/types'
import {account} from '#/storage'
import {AppViewSelector, type AppViewSelectorValue} from './AppViewSelector'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'AppViewTransferSettings'
>

type PendingTransfer = {
  source: AppViewPreference
  destination: AppViewPreference
}

export function AppViewTransferSettingsScreen({}: Props) {
  const {t: l} = useLingui()
  const t = useTheme()
  const client = useAppviewClient()
  const queryClient = useQueryClient()
  const {currentAccount} = useSession()
  const accountDid = currentAccount!.did
  const storedCheckpoint = account.get([accountDid, 'appViewTransfer'])
  const initialCheckpoint =
    storedCheckpoint?.version === 1 &&
    storedCheckpoint.accountDid === accountDid
      ? storedCheckpoint
      : undefined

  const [checkpoint, setCheckpoint] = useState(initialCheckpoint)
  const checkpointRef = useRef(checkpoint)
  const mountedRef = useRef(false)
  const runningRef = useRef(false)
  const abortRef = useRef<AbortController | undefined>(undefined)
  const confirmControl = Prompt.usePromptControl()
  const [pendingTransfer, setPendingTransfer] = useState<PendingTransfer>()
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string>()
  const [sourceSelection, setSourceSelection] = useState<AppViewSelectorValue>(
    () => selectionFromPreference(initialCheckpoint?.source, 'bluesky'),
  )
  const [destinationSelection, setDestinationSelection] =
    useState<AppViewSelectorValue>(() =>
      selectionFromPreference(initialCheckpoint?.destination, 'eurosky'),
    )
  const [selectedCollections, setSelectedCollections] = useState<
    AppViewTransferCollectionId[]
  >(
    initialCheckpoint?.selectedCollections ?? [
      ...APP_VIEW_TRANSFER_COLLECTIONS,
    ],
  )

  const collectionNames = useCollectionNames()
  const isRunning = checkpoint?.status === 'running'
  const hasFailedCollections = checkpoint?.selectedCollections.some(
    id => checkpoint.collections[id]?.status === 'failed',
  )
  const hasIncompleteCollections = checkpoint?.selectedCollections.some(id =>
    ['failed', 'unsupported'].includes(
      checkpoint.collections[id]?.status ?? 'pending',
    ),
  )

  const saveCheckpoint = (next: AppViewTransferCheckpoint) => {
    checkpointRef.current = next
    account.set([accountDid, 'appViewTransfer'], next)
    if (mountedRef.current) setCheckpoint(next)
  }

  useEffect(() => {
    mountedRef.current = true
    const current = checkpointRef.current
    if (current?.status === 'running') {
      saveCheckpoint({...current, status: 'paused'})
    }
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
      const latest = checkpointRef.current
      if (latest?.status === 'running') {
        account.set([accountDid, 'appViewTransfer'], {
          ...latest,
          status: 'paused',
          updatedAt: new Date().toISOString(),
        })
      }
    }
  }, [accountDid])

  const displayName = (preference: AppViewPreference) => {
    const preset = APP_VIEW_PRESETS.find(item => item.did === preference.did)
    if (preset?.id === 'bluesky') return l`Bluesky`
    if (preset?.id === 'eurosky') return l`Eurosky`
    if (preset?.id === 'blacksky') return l`Blacksky`
    try {
      return new URL(preference.url).host
    } catch {
      return preference.did
    }
  }

  const resolveSelection = async (
    selection: AppViewSelectorValue,
  ): Promise<AppViewPreference> => {
    if (selection.option === 'custom') {
      return resolveCustomAppView(selection.customUrl)
    }
    return APP_VIEW_PRESETS.find(preset => preset.id === selection.option)!
  }

  const validationMessage = (cause: unknown) => {
    if (!(cause instanceof AppViewValidationError)) {
      return l`We couldn’t verify this service. Check the URL and try again.`
    }
    switch (cause.code) {
      case 'invalid-url':
        return l`Enter a valid service URL.`
      case 'https-required':
        return l`The service URL must use HTTPS.`
      case 'base-url-required':
        return l`Enter only the service’s base URL, without a path, query, or fragment.`
      case 'did-document-unavailable':
        return l`We couldn’t load this service’s identity information.`
      case 'invalid-did-document':
        return l`This URL doesn’t publish valid matching identity information.`
      case 'missing-appview-service':
        return l`This service isn’t configured as a compatible content service.`
      case 'endpoint-mismatch':
        return l`The registered service endpoint doesn’t match this URL.`
    }
  }

  const prepareTransfer = async () => {
    if (isRunning || isChecking) return
    if (selectedCollections.length === 0) {
      setError(l`Select at least one type of data to transfer.`)
      return
    }

    setError(undefined)
    setIsChecking(true)
    try {
      const [source, destination] = await Promise.all([
        resolveSelection(sourceSelection),
        resolveSelection(destinationSelection),
      ])
      if (source.did === destination.did) {
        setError(l`Choose two different content services.`)
        return
      }
      setPendingTransfer({source, destination})
      confirmControl.open()
    } catch (cause) {
      setError(validationMessage(cause))
    } finally {
      setIsChecking(false)
    }
  }

  const executeTransfer = async (initial: AppViewTransferCheckpoint) => {
    if (runningRef.current) return
    runningRef.current = true
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await runAppViewTransfer({
        client,
        initialCheckpoint: initial,
        signal: controller.signal,
        onProgress: saveCheckpoint,
        onCollectionError(id, cause) {
          logger.error('AppView transfer collection failed', {
            collection: id,
            safeMessage: `${getErrorStatus(cause) ?? 'unknown'}:${getErrorName(cause) ?? 'unknown'}`,
          })
        },
      })
      invalidateAppViewQueries()
    } catch {
      const latest = checkpointRef.current
      if (latest?.status === 'running') {
        saveCheckpoint({
          ...latest,
          status: 'paused',
          updatedAt: new Date().toISOString(),
        })
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = undefined
        runningRef.current = false
      }
    }
  }

  const invalidateAppViewQueries = () => {
    for (const root of [
      'my-muted-accounts',
      'my-lists',
      'bookmarks',
      'activity-subscriptions',
      'notification-settings',
    ]) {
      void queryClient.invalidateQueries({queryKey: [root]})
    }
  }

  const confirmTransfer = () => {
    if (!pendingTransfer) return
    const next = createTransferCheckpoint({
      accountDid,
      source: pendingTransfer.source,
      destination: pendingTransfer.destination,
      selectedCollections,
    })
    setPendingTransfer(undefined)
    void executeTransfer(next)
  }

  const pauseTransfer = () => {
    abortRef.current?.abort()
  }

  const resumeTransfer = () => {
    if (!checkpoint || isRunning) return
    void executeTransfer(checkpoint)
  }

  const startOver = () => {
    abortRef.current?.abort()
    checkpointRef.current = undefined
    account.remove([accountDid, 'appViewTransfer'])
    setCheckpoint(undefined)
    setError(undefined)
  }

  const confirmationDescription = pendingTransfer
    ? l`Copy the selected data from ${displayName(pendingTransfer.source)} to ${displayName(pendingTransfer.destination)}? Existing items at the destination will be kept. Notification preferences at the destination will be replaced.`
    : ''

  return (
    <Layout.Screen testID="appViewTransferSettingsScreen">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Transfer app data</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          {!checkpoint && (
            <>
              <SettingsList.Group contentContainerStyle={[a.gap_lg]}>
                <SettingsList.ItemIcon icon={TransferIcon} />
                <SettingsList.ItemText>
                  <Trans>Transfer app data</Trans>
                </SettingsList.ItemText>
                <Text
                  style={[
                    a.text_sm,
                    a.leading_snug,
                    t.atoms.text_contrast_medium,
                  ]}>
                  <Trans>
                    Copy private app data between content services without
                    changing which service is active. You can run the transfer
                    again later.
                  </Trans>
                </Text>
                <Admonition.Admonition type="info">
                  <Trans>
                    This is an import, not a sync. Existing destination data is
                    kept, and later removals do not carry between services.
                    Drafts and account mutes limited to reposts or quote posts
                    are not included in this version.
                  </Trans>
                </Admonition.Admonition>
              </SettingsList.Group>

              <SettingsList.Group contentContainerStyle={[a.gap_lg]}>
                <SettingsList.ItemIcon icon={TransferIcon} />
                <SettingsList.ItemText>
                  <Trans>Content services</Trans>
                </SettingsList.ItemText>
                <AppViewSelector
                  titleText={<Trans>From</Trans>}
                  label={l`Source content service`}
                  value={sourceSelection}
                  onChange={value => {
                    setSourceSelection(value)
                    setError(undefined)
                  }}
                />
                <AppViewSelector
                  titleText={<Trans>To</Trans>}
                  label={l`Destination content service`}
                  value={destinationSelection}
                  onChange={value => {
                    setDestinationSelection(value)
                    setError(undefined)
                  }}
                />
              </SettingsList.Group>

              <SettingsList.Group contentContainerStyle={[a.gap_md]}>
                <SettingsList.ItemIcon icon={ListIcon} />
                <SettingsList.ItemText>
                  <Trans>Data to transfer</Trans>
                </SettingsList.ItemText>
                <Toggle.Group
                  type="checkbox"
                  label={l`Data to transfer`}
                  values={selectedCollections}
                  onChange={values => {
                    setSelectedCollections(values.filter(isCollectionId))
                    setError(undefined)
                  }}>
                  <View style={[a.gap_md, a.w_full]}>
                    {APP_VIEW_TRANSFER_COLLECTIONS.map(id => (
                      <Toggle.Item
                        key={id}
                        name={id}
                        label={collectionNames[id]}>
                        <Toggle.Checkbox />
                        <Toggle.LabelText
                          style={[a.flex_1, a.font_normal, a.text_md]}>
                          {collectionNames[id]}
                        </Toggle.LabelText>
                      </Toggle.Item>
                    ))}
                  </View>
                </Toggle.Group>
                <Text
                  style={[
                    a.text_xs,
                    a.leading_snug,
                    t.atoms.text_contrast_medium,
                  ]}>
                  <Trans>
                    Notification preferences from the source replace
                    notification preferences at the destination. Other selected
                    data is added without removing destination-only items.
                  </Trans>
                </Text>
              </SettingsList.Group>
            </>
          )}

          {checkpoint && (
            <>
              {checkpoint.status === 'complete' ? (
                <>
                  <TransferResultNotice
                    hasIncompleteCollections={!!hasIncompleteCollections}
                  />
                  <TransferStatus
                    checkpoint={checkpoint}
                    sourceName={displayName(checkpoint.source)}
                    destinationName={displayName(checkpoint.destination)}
                    collectionNames={collectionNames}
                  />
                </>
              ) : (
                <TransferProgress
                  checkpoint={checkpoint}
                  collectionNames={collectionNames}
                />
              )}
            </>
          )}

          <View style={[a.gap_md, a.px_xl, a.py_lg]}>
            <FormError error={error} />
            {!checkpoint && (
              <Button
                label={l`Start transfer`}
                size="large"
                color="primary"
                disabled={isChecking || selectedCollections.length === 0}
                onPress={() => void prepareTransfer()}
                testID="startAppViewTransferButton">
                <ButtonText>
                  {isChecking ? (
                    <Trans>Checking…</Trans>
                  ) : (
                    <Trans>Continue</Trans>
                  )}
                </ButtonText>
                {isChecking && <ButtonIcon icon={Loader} />}
              </Button>
            )}
            {isRunning && (
              <Button
                label={l`Pause transfer`}
                size="large"
                color="secondary"
                onPress={pauseTransfer}>
                <ButtonText>
                  <Trans>Pause transfer</Trans>
                </ButtonText>
              </Button>
            )}
            {checkpoint?.status === 'paused' && (
              <>
                <Button
                  label={l`Resume transfer`}
                  size="large"
                  color="primary"
                  onPress={resumeTransfer}>
                  <ButtonText>
                    <Trans>Resume transfer</Trans>
                  </ButtonText>
                </Button>
                <Button
                  label={l`Start over`}
                  size="large"
                  color="secondary"
                  onPress={startOver}>
                  <ButtonText>
                    <Trans>Start over</Trans>
                  </ButtonText>
                </Button>
              </>
            )}
            {checkpoint?.status === 'complete' && hasFailedCollections && (
              <Button
                label={l`Retry incomplete items`}
                size="large"
                color="primary"
                onPress={resumeTransfer}>
                <ButtonText>
                  <Trans>Retry incomplete items</Trans>
                </ButtonText>
              </Button>
            )}
            {checkpoint?.status === 'complete' && (
              <Button
                label={l`Start a new transfer`}
                size="large"
                color={hasFailedCollections ? 'secondary' : 'primary'}
                onPress={startOver}>
                <ButtonText>
                  <Trans>Start a new transfer</Trans>
                </ButtonText>
              </Button>
            )}
          </View>
        </SettingsList.Container>
      </Layout.Content>

      <Prompt.Basic
        control={confirmControl}
        title={l`Start data transfer?`}
        description={confirmationDescription}
        cancelButtonCta={l`Cancel`}
        confirmButtonCta={l`Start transfer`}
        onConfirm={confirmTransfer}
        onClose={() => setPendingTransfer(undefined)}
      />
    </Layout.Screen>
  )
}

function TransferResultNotice({
  hasIncompleteCollections,
}: {
  hasIncompleteCollections: boolean
}) {
  return (
    <View style={[a.px_xl, a.py_sm]}>
      <Admonition.Admonition
        type={hasIncompleteCollections ? 'warning' : 'tip'}>
        {hasIncompleteCollections ? (
          <Trans>
            Some data couldn’t be transferred. See the results below.
          </Trans>
        ) : (
          <Trans>The transfer has finished.</Trans>
        )}
      </Admonition.Admonition>
    </View>
  )
}

function TransferProgress({
  checkpoint,
  collectionNames,
}: {
  checkpoint: AppViewTransferCheckpoint
  collectionNames: Record<AppViewTransferCollectionId, string>
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const activeId =
    checkpoint.selectedCollections.find(id => {
      const status = checkpoint.collections[id]?.status ?? 'pending'
      return !['complete', 'failed', 'unsupported'].includes(status)
    }) ?? checkpoint.selectedCollections.at(-1)
  const totalProgress = checkpoint.selectedCollections.reduce((total, id) => {
    const progress = checkpoint.collections[id] ?? emptyProgress()
    return total + collectionProgress(progress)
  }, 0)
  const percent = checkpoint.selectedCollections.length
    ? (totalProgress / checkpoint.selectedCollections.length) * 100
    : 0
  const activeName = activeId ? collectionNames[activeId] : l`app data`
  const statusText =
    checkpoint.status === 'paused'
      ? l`Paused while transferring ${activeName}`
      : l`Transferring ${activeName}…`

  return (
    <SettingsList.Group contentContainerStyle={[a.gap_md]}>
      <SettingsList.ItemIcon icon={ProgressIcon} />
      <SettingsList.ItemText>
        <Trans>Transfer progress</Trans>
      </SettingsList.ItemText>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{min: 0, max: 100, now: Math.round(percent)}}
        style={[
          a.w_full,
          a.rounded_full,
          {height: 8, backgroundColor: t.palette.contrast_100},
        ]}>
        <View
          style={[
            a.rounded_full,
            {
              height: 8,
              width: `${percent}%`,
              backgroundColor: t.palette.primary_500,
            },
          ]}
        />
      </View>
      <Text
        style={[a.w_full, a.text_sm, t.atoms.text_contrast_medium]}
        numberOfLines={1}>
        {statusText}
      </Text>
      <Text
        style={[a.w_full, a.text_xs, t.atoms.text_contrast_low]}
        numberOfLines={1}>
        {checkpoint.status === 'paused' ? (
          <Trans>Resume the transfer to continue.</Trans>
        ) : (
          <Trans>Keep this page open while the transfer is running.</Trans>
        )}
      </Text>
    </SettingsList.Group>
  )
}

function collectionProgress(
  progress: AppViewTransferCollectionProgress,
): number {
  switch (progress.status) {
    case 'complete':
    case 'failed':
    case 'unsupported':
      return 1
    case 'pending':
      return 0
    case 'countingSource':
      return 0.05
    case 'countingDestination':
      return 0.15
    case 'transferring':
      return progress.sourceCount > 0
        ? 0.2 +
            0.75 *
              Math.min(1, (progress.processedCount ?? 0) / progress.sourceCount)
        : 0.95
    case 'countingFinal':
      return 0.98
  }
}

function TransferStatus({
  checkpoint,
  sourceName,
  destinationName,
  collectionNames,
}: {
  checkpoint: AppViewTransferCheckpoint
  sourceName: string
  destinationName: string
  collectionNames: Record<AppViewTransferCollectionId, string>
}) {
  const {t: l} = useLingui()
  const t = useTheme()
  const finished = checkpoint.status === 'complete'

  const statusText = (progress: AppViewTransferCollectionProgress) => {
    switch (progress.status) {
      case 'pending':
        return l`Waiting`
      case 'countingSource':
      case 'countingDestination':
        return l`Checking…`
      case 'transferring':
        return l`Copying…`
      case 'countingFinal':
        return l`Verifying…`
      case 'complete':
        return l`Complete`
      case 'failed':
        return progress.failureAt === 'source'
          ? l`${sourceName} unavailable`
          : l`${destinationName} unavailable`
      case 'unsupported':
        return progress.unsupportedAt === 'source'
          ? l`Unavailable on ${sourceName}`
          : l`Unavailable on ${destinationName}`
    }
  }

  return (
    <SettingsList.Group contentContainerStyle={[a.gap_md]}>
      <SettingsList.ItemIcon icon={finished ? CheckIcon : ProgressIcon} />
      <SettingsList.ItemText>
        {finished ? (
          <Trans>Transfer summary</Trans>
        ) : (
          <Trans>Transfer progress</Trans>
        )}
      </SettingsList.ItemText>
      <View style={[a.w_full]}>
        {checkpoint.selectedCollections.map((id, index) => {
          const progress = checkpoint.collections[id] ?? emptyProgress()
          const before = progress.destinationBefore
          const current = progress.destinationAfter ?? before
          const destinationValue = progress.destinationScanned
            ? `${before ?? 0} → ${current ?? 0} (+${progress.transferredCount})`
            : `… → … (+${progress.transferredCount})`
          return (
            <View
              key={id}
              style={[
                a.gap_2xs,
                a.py_sm,
                index > 0 && [a.border_t, t.atoms.border_contrast_low],
              ]}>
              <View
                style={[
                  a.flex_row,
                  a.align_center,
                  a.justify_between,
                  a.gap_sm,
                ]}>
                <Text style={[a.flex_1, a.font_semi_bold]} numberOfLines={1}>
                  {collectionNames[id]}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    a.text_xs,
                    progress.status === 'failed'
                      ? {color: t.palette.negative_500}
                      : t.atoms.text_contrast_medium,
                  ]}>
                  {statusText(progress)}
                </Text>
              </View>
              <SummaryLine
                label={sourceName}
                value={progress.sourceScanned ? `${progress.sourceCount}` : '…'}
              />
              <SummaryLine label={destinationName} value={destinationValue} />
            </View>
          )
        })}
      </View>
    </SettingsList.Group>
  )
}

function SummaryLine({label, value}: {label: string; value: string}) {
  const t = useTheme()
  return (
    <View style={[a.flex_row, a.justify_between, a.gap_md]}>
      <Text
        style={[a.flex_1, a.text_sm, t.atoms.text_contrast_medium]}
        numberOfLines={1}>
        {label}
      </Text>
      <Text style={[a.text_sm, a.font_semi_bold]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

function useCollectionNames(): Record<AppViewTransferCollectionId, string> {
  const {t: l} = useLingui()
  return {
    mutedAccounts: l`Muted accounts`,
    mutedLists: l`Muted lists`,
    bookmarks: l`Bookmarks`,
    activitySubscriptions: l`Activity notifications`,
    notificationPreferences: l`Notification preferences`,
  }
}

function emptyProgress(): AppViewTransferCollectionProgress {
  return {status: 'pending', sourceCount: 0, transferredCount: 0}
}

function selectionFromPreference(
  preference: AppViewPreference | undefined,
  fallback: 'bluesky' | 'eurosky',
): AppViewSelectorValue {
  if (!preference) return {option: fallback, customUrl: ''}
  const option = getAppViewOptionId(preference)
  return {
    option,
    customUrl: option === 'custom' ? preference.url : '',
  }
}

function isCollectionId(value: string): value is AppViewTransferCollectionId {
  return APP_VIEW_TRANSFER_COLLECTIONS.includes(
    value as AppViewTransferCollectionId,
  )
}
