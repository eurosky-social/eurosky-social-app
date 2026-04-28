import {View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {atoms as a, useTheme} from '#/alf'
import {LeaveConvoPrompt} from '#/components/dms/LeaveConvoPrompt'
import {type ConvoWithDetails} from '#/components/dms/util'
import {KnownFollowers} from '#/components/KnownFollowers'
import {usePromptControl} from '#/components/Prompt'
import {AcceptChatButton, DeleteChatButton, RejectMenu} from './RequestButtons'

export function ChatStatusInfo({convo}: {convo: ConvoWithDetails}) {
  const t = useTheme()
  const {_} = useLingui()
  const moderationOpts = useModerationOpts()
  const leaveConvoControl = usePromptControl()

  // either the other person, or the chat owner
  // if we ever allow someone other than the owner to invite people, this will need to change
  const otherUser = convo.primaryMember

  if (!moderationOpts) {
    return null
  }

  return (
    <View style={[t.atoms.bg, a.p_lg, a.gap_md, a.align_center]}>
      {otherUser && (
        <KnownFollowers
          profile={otherUser}
          moderationOpts={moderationOpts}
          showIfEmpty
        />
      )}
      <View style={[a.flex_row, a.gap_md, a.w_full, otherUser && a.pt_sm]}>
        {otherUser && (
          <RejectMenu
            label={_(msg`Block or report`)}
            convo={convo.view}
            profile={otherUser}
            color="negative_subtle"
            size="small"
            currentScreen="conversation"
          />
        )}
        <DeleteChatButton
          label={_(msg`Delete`)}
          convo={convo.view}
          color="secondary"
          size="small"
          currentScreen="conversation"
          onPress={leaveConvoControl.open}
        />
        <LeaveConvoPrompt
          convoId={convo.view.id}
          control={leaveConvoControl}
          currentScreen="conversation"
          hasMessages={false}
        />
      </View>
      <View style={[a.w_full, a.flex_row]}>
        <AcceptChatButton
          convo={convo.view}
          color="primary_subtle"
          size="small"
          currentScreen="conversation"
        />
      </View>
    </View>
  )
}
