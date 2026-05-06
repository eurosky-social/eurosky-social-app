import {memo, useCallback} from 'react'
import {Platform} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import {type ChatBskyConvoDefs, RichText} from '@atproto/api'
import {useLingui} from '@lingui/react/macro'

import {useGoogleTranslate} from '#/lib/hooks/useGoogleTranslate'
import {richTextToString} from '#/lib/strings/rich-text-helpers'
import {useLanguagePrefs} from '#/state/preferences'
import {useSession} from '#/state/session'
import {useMessageOverlays} from '#/screens/Messages/components/MessageOverlays'
import {atoms as a} from '#/alf'
import * as ContextMenu from '#/components/ContextMenu'
import {type TriggerProps} from '#/components/ContextMenu/types'
import {BubbleQuestion_Stroke2_Corner0_Rounded as TranslateIcon} from '#/components/icons/Bubble'
import {Clipboard_Stroke2_Corner2_Rounded as ClipboardIcon} from '#/components/icons/Clipboard'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import {Warning_Stroke2_Corner0_Rounded as WarningIcon} from '#/components/icons/Warning'
import * as Toast from '#/components/Toast'
import {useAnalytics} from '#/analytics'
import {IS_NATIVE} from '#/env'
import type * as bsky from '#/types/bsky'
import {EmojiReactionPicker} from './EmojiReactionPicker'
import {useToggleMessageReaction} from './useToggleMessageReaction'

export let MessageContextMenu = ({
  message,
  senderProfile,
  children,
  onTap,
}: {
  message: ChatBskyConvoDefs.MessageView
  senderProfile?: bsky.profile.AnyProfileView
  children: TriggerProps['children']
  onTap?: () => void
}): React.ReactNode => {
  const {t: l} = useLingui()
  const ax = useAnalytics()
  const {currentAccount} = useSession()
  const {openReport, openDeleteConfirm} = useMessageOverlays()
  const langPrefs = useLanguagePrefs()
  const translate = useGoogleTranslate()
  const onEmojiSelect = useToggleMessageReaction(message)

  const isFromSelf = message.sender?.did === currentAccount?.did
  const isGroupChatEnabled = ax.features.enabled(ax.features.GroupChatsEnable)

  const onCopyMessage = useCallback(() => {
    const str = richTextToString(
      new RichText({
        text: message.text,
        facets: message.facets,
      }),
      true,
    )

    void Clipboard.setStringAsync(str)
    Toast.show(l`Copied to clipboard`, {
      type: 'success',
    })
  }, [l, message.text, message.facets])

  const onPressTranslateMessage = useCallback(() => {
    void translate(message.text, langPrefs.primaryLanguage)

    ax.metric('translate', {
      os: Platform.OS,
      possibleSourceLanguages: [], // N/A for chats
      expectedTargetLanguage: langPrefs.primaryLanguage,
      textLength: message.text.length,
      googleTranslate: true,
    })
  }, [ax, langPrefs.primaryLanguage, message.text, translate])

  const sender = senderProfile

  return (
    <ContextMenu.Root>
      {IS_NATIVE && (
        <ContextMenu.AuxiliaryView
          align={isFromSelf ? 'right' : 'left'}
          style={[isFromSelf && isGroupChatEnabled ? null : a.ml_sm]}>
          <EmojiReactionPicker
            message={message}
            onEmojiSelect={onEmojiSelect}
          />
        </ContextMenu.AuxiliaryView>
      )}

      <ContextMenu.Trigger
        label={l`Message options`}
        contentLabel={l`Message from @${
          sender?.handle ?? 'unknown' // should always be defined
        }: ${message.text}`}
        onTap={onTap}>
        {children}
      </ContextMenu.Trigger>

      <ContextMenu.Outer
        align={isFromSelf ? 'right' : 'left'}
        style={[isFromSelf && isGroupChatEnabled ? null : a.ml_sm]}>
        {message.text.length > 0 && (
          <>
            <ContextMenu.Item
              testID="messageDropdownTranslateBtn"
              label={l`Translate`}
              onPress={onPressTranslateMessage}>
              <ContextMenu.ItemText>{l`Translate`}</ContextMenu.ItemText>
              <ContextMenu.ItemIcon icon={TranslateIcon} position="right" />
            </ContextMenu.Item>
            <ContextMenu.Item
              testID="messageDropdownCopyBtn"
              label={l`Copy message text`}
              onPress={onCopyMessage}>
              <ContextMenu.ItemText>
                {l`Copy message text`}
              </ContextMenu.ItemText>
              <ContextMenu.ItemIcon icon={ClipboardIcon} position="right" />
            </ContextMenu.Item>
            <ContextMenu.Divider />
          </>
        )}
        <ContextMenu.Item
          testID="messageDropdownDeleteBtn"
          label={l`Delete message for me`}
          onPress={() => openDeleteConfirm(message.id)}>
          <ContextMenu.ItemText>{l`Delete for me`}</ContextMenu.ItemText>
          <ContextMenu.ItemIcon icon={TrashIcon} position="right" />
        </ContextMenu.Item>
        {!isFromSelf && (
          <ContextMenu.Item
            testID="messageDropdownReportBtn"
            label={l`Report message`}
            onPress={() => openReport({message, senderProfile: sender})}>
            <ContextMenu.ItemText>{l`Report`}</ContextMenu.ItemText>
            <ContextMenu.ItemIcon icon={WarningIcon} position="right" />
          </ContextMenu.Item>
        )}
      </ContextMenu.Outer>
    </ContextMenu.Root>
  )
}
MessageContextMenu = memo(MessageContextMenu)
