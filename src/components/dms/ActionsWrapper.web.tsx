import {useCallback, useRef, useState} from 'react'
import {Pressable, View} from 'react-native'
import {type ChatBskyConvoDefs} from '@atproto/api'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {MessageContextMenu} from '#/components/dms/MessageContextMenu'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsHorizontalIcon} from '#/components/icons/DotGrid'
import {EmojiSmile_Stroke2_Corner0_Rounded as EmojiSmileIcon} from '#/components/icons/Emoji'
import type * as bsky from '#/types/bsky'
import {EmojiReactionPicker} from './EmojiReactionPicker'
import {useToggleMessageReaction} from './useToggleMessageReaction'

export function ActionsWrapper({
  message,
  hasReactions,
  isFromSelf,
  senderProfile,
  children,
  onTap,
}: {
  message: ChatBskyConvoDefs.MessageView
  hasReactions?: boolean
  isFromSelf: boolean
  senderProfile?: bsky.profile.AnyProfileView
  children: React.ReactNode
  onTap?: () => void
}) {
  const viewRef = useRef(null)
  const t = useTheme()
  const {t: l} = useLingui()
  const onEmojiSelect = useToggleMessageReaction(message)

  const [showActions, setShowActions] = useState(false)

  const onMouseEnter = useCallback(() => {
    setShowActions(true)
  }, [])

  const onMouseLeave = useCallback(() => {
    setShowActions(false)
  }, [])

  // We need to handle the `onFocus` separately because we want to know if there is a related target (the element
  // that is losing focus). If there isn't that means the focus is coming from a dropdown that is now closed.
  const onFocus = useCallback<React.FocusEventHandler>(e => {
    if (e.nativeEvent.relatedTarget == null) return
    setShowActions(true)
  }, [])

  return (
    <View
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      // @ts-expect-error web only
      onFocus={onFocus}
      onBlur={onMouseLeave}
      style={[a.flex_1, isFromSelf ? a.flex_row : a.flex_row_reverse]}
      ref={viewRef}>
      <View
        style={[
          a.justify_center,
          a.flex_row,
          a.align_center,
          isFromSelf
            ? [a.mr_xs, {marginLeft: 'auto'}, a.flex_row_reverse]
            : [a.ml_xs, {marginRight: 'auto'}],
          hasReactions ? [a.mb_2xl] : undefined,
        ]}>
        <EmojiReactionPicker message={message} onEmojiSelect={onEmojiSelect}>
          {({props, state, IS_NATIVE, control}) => {
            // always false, file is platform split
            if (IS_NATIVE) return null
            const showMenuTrigger = showActions || control.isOpen ? 1 : 0
            return (
              <Pressable
                {...props}
                style={[
                  {opacity: showMenuTrigger},
                  a.p_xs,
                  a.rounded_full,
                  (state.hovered || state.pressed) && t.atoms.bg_contrast_25,
                ]}>
                <EmojiSmileIcon
                  size="md"
                  style={t.atoms.text_contrast_medium}
                />
              </Pressable>
            )
          }}
        </EmojiReactionPicker>
        <MessageContextMenu message={message} senderProfile={senderProfile}>
          {({props, state, IS_NATIVE, control}) => {
            // always false, file is platform split
            if (IS_NATIVE) return null
            const showMenuTrigger = showActions || control.isOpen ? 1 : 0
            return (
              <Pressable
                {...props}
                style={[
                  {opacity: showMenuTrigger},
                  a.p_xs,
                  a.rounded_full,
                  (state.hovered || state.pressed) && t.atoms.bg_contrast_25,
                ]}>
                <DotsHorizontalIcon
                  size="md"
                  style={t.atoms.text_contrast_medium}
                />
              </Pressable>
            )
          }}
        </MessageContextMenu>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityHint={l`Click to view the date and time`}
        onPress={onTap}
        style={[{maxWidth: '80%'}, isFromSelf ? a.align_end : a.align_start]}>
        {children}
      </Pressable>
    </View>
  )
}
