import {createContext, useCallback, useContext, useMemo, useState} from 'react'
import {LayoutAnimation} from 'react-native'
import {type ChatBskyActorDefs, type ChatBskyConvoDefs} from '@atproto/api'
import {useLingui} from '@lingui/react/macro'
import {useQueryClient} from '@tanstack/react-query'

import {useConvoActive} from '#/state/messages/convo'
import {unstableCacheProfileView} from '#/state/queries/unstable-profile-cache'
import {useDialogControl} from '#/components/Dialog'
import {AfterReportDialog} from '#/components/dms/AfterReportDialog'
import {type Reaction, ReactionsDialog} from '#/components/dms/ReactionsDialog'
import {ReportDialog} from '#/components/moderation/ReportDialog'
import * as Prompt from '#/components/Prompt'
import {usePromptControl} from '#/components/Prompt'
import * as Toast from '#/components/Toast'
import type * as bsky from '#/types/bsky'

type ReactionsParams = {
  message: ChatBskyConvoDefs.MessageView
  relatedProfiles: Map<string, ChatBskyActorDefs.ProfileViewBasic>
  reactions?: ChatBskyConvoDefs.ReactionView[]
  groupedReactions?: Reaction[]
}

type ReportParams = {
  message: ChatBskyConvoDefs.MessageView
  senderProfile?: bsky.profile.AnyProfileView
}

type MessageOverlaysContextValue = {
  openReactions: (params: ReactionsParams) => void
  openReport: (params: ReportParams) => void
  openDeleteConfirm: (messageId: string) => void
}

const MessageOverlaysContext =
  createContext<MessageOverlaysContextValue | null>(null)

export function useMessageOverlays(): MessageOverlaysContextValue {
  const value = useContext(MessageOverlaysContext)
  if (!value) {
    throw new Error(
      'useMessageOverlays must be used inside MessageOverlaysProvider',
    )
  }
  return value
}

/**
 * Hosts singleton instances of the per-message dialogs that were previously
 * mounted once per MessageItem. Per-message components dispatch into this
 * provider via useMessageOverlays() so only one of each dialog exists in the
 * tree regardless of how many messages are mounted.
 */
export function MessageOverlaysProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const {t: l} = useLingui()
  const convo = useConvoActive()
  const queryClient = useQueryClient()

  const reactionsControl = useDialogControl()
  const reportControl = usePromptControl()
  const afterReportControl = usePromptControl()
  const deleteControl = usePromptControl()

  const [reactionsParams, setReactionsParams] =
    useState<ReactionsParams | null>(null)
  const [reportParams, setReportParams] = useState<ReportParams | null>(null)
  const [afterReportMessage, setAfterReportMessage] =
    useState<ChatBskyConvoDefs.MessageView | null>(null)
  const [deleteMessageId, setDeleteMessageId] = useState<string | null>(null)

  const openReactions = useCallback(
    (params: ReactionsParams) => {
      setReactionsParams(params)
      reactionsControl.open()
    },
    [reactionsControl],
  )

  const openReport = useCallback(
    (params: ReportParams) => {
      setReportParams(params)
      reportControl.open()
    },
    [reportControl],
  )

  const openDeleteConfirm = useCallback(
    (messageId: string) => {
      setDeleteMessageId(messageId)
      deleteControl.open()
    },
    [deleteControl],
  )

  const onConfirmDelete = useCallback(() => {
    if (deleteMessageId == null) return
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    convo
      .deleteMessage(deleteMessageId)
      .then(() => Toast.show(l({message: 'Message deleted', context: 'toast'})))
      .catch(() => Toast.show(l`Failed to delete message`))
  }, [convo, deleteMessageId, l])

  const onAfterReportSubmit = useCallback(() => {
    if (!reportParams) return
    if (reportParams.senderProfile) {
      unstableCacheProfileView(queryClient, reportParams.senderProfile)
    }
    setAfterReportMessage(reportParams.message)
    afterReportControl.open()
  }, [reportParams, queryClient, afterReportControl])

  const value = useMemo<MessageOverlaysContextValue>(
    () => ({openReactions, openReport, openDeleteConfirm}),
    [openReactions, openReport, openDeleteConfirm],
  )

  return (
    <MessageOverlaysContext.Provider value={value}>
      {children}
      {reactionsParams && (
        <ReactionsDialog
          control={reactionsControl}
          relatedProfiles={reactionsParams.relatedProfiles}
          message={reactionsParams.message}
          reactions={reactionsParams.reactions}
          groupedReactions={reactionsParams.groupedReactions}
        />
      )}
      {reportParams && (
        <ReportDialog
          control={reportControl}
          subject={{
            view: 'message',
            convoId: convo.convo.view.id,
            message: reportParams.message,
          }}
          onAfterSubmit={onAfterReportSubmit}
        />
      )}
      {afterReportMessage && (
        <AfterReportDialog
          control={afterReportControl}
          currentScreen="conversation"
          params={{
            convoId: convo.convo.view.id,
            message: afterReportMessage,
          }}
        />
      )}
      <Prompt.Basic
        control={deleteControl}
        title={l`Delete message`}
        description={l`Are you sure you want to delete this message? The message will be deleted for you, but not for the other participants.`}
        confirmButtonCta={l`Delete`}
        confirmButtonColor="negative"
        onConfirm={onConfirmDelete}
      />
    </MessageOverlaysContext.Provider>
  )
}
