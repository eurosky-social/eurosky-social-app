import {Pressable, View} from 'react-native'
import {type ModerationDecision} from '@bsky/sdk/moderation'
import {Trans, useLingui} from '@lingui/react/macro'

import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {useProfileQuery} from '#/state/queries/profile'
import {useRequireAuth, useSession} from '#/state/session'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'
import {commentSecond, type Moment} from '../moments'
import {formatMediaTime} from '../record'
import {usePlaybackSecond} from '../usePlaybackSecond'

type PostView = app.bsky.feed.defs.PostView

/**
 * "at 0:41 · Add to this moment…": opens the composer, linked to the second
 * being watched (or `fallbackSeconds` before the video has played), kept
 * inside `within` when given.
 */
export function ComposerField({
  videoPost,
  videoModeration,
  fallbackSeconds,
  placeholder,
  within,
  onBeforeCompose,
}: {
  videoPost: PostView & {record: app.bsky.feed.post.Main}
  videoModeration: ModerationDecision
  /** The second to use before the video has played. */
  fallbackSeconds: number
  /** E.g. "Add to this moment…". */
  placeholder: string
  /** The moment the comment is added to; the second stays inside it. */
  within?: Moment
  onBeforeCompose?: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {openComposer} = useOpenComposer()
  const requireAuth = useRequireAuth()
  const {currentAccount} = useSession()
  const {data: profile} = useProfileQuery({did: currentAccount?.did})
  const playing = usePlaybackSecond(videoPost.uri)
  const commentSeconds = commentSecond({playing, fallbackSeconds, within})
  const time = formatMediaTime(commentSeconds)

  const onPress = () =>
    requireAuth(() => {
      onBeforeCompose?.()
      openComposer({
        replyTo: {
          uri: videoPost.uri,
          cid: videoPost.cid,
          text: videoPost.record.text,
          author: videoPost.author,
          embed: videoPost.embed,
          langs: videoPost.record.langs,
          moderation: videoModeration,
        },
        mediaTime: commentSeconds,
        logContext: 'PostReply',
      })
    })

  return (
    <View style={[a.flex_row, a.align_center, a.gap_sm]}>
      {profile ? (
        <UserAvatar
          size={36}
          avatar={profile.avatar}
          type={profile.associated?.labeler ? 'labeler' : 'user'}
        />
      ) : null}
      <Pressable
        testID="momentAddComment"
        accessibilityRole="button"
        accessibilityLabel={l`Add a comment at ${time}`}
        accessibilityHint=""
        onPress={onPress}
        style={[
          a.flex_1,
          a.flex_row,
          a.align_center,
          a.gap_sm,
          a.rounded_full,
          a.border,
          t.atoms.bg_contrast_25,
          t.atoms.border_contrast_low,
          {height: 44, paddingHorizontal: 6},
        ]}>
        <View
          style={[
            a.rounded_full,
            a.justify_center,
            {
              height: 32,
              paddingHorizontal: 10,
              backgroundColor: t.palette.primary_50,
            },
          ]}>
          <Text
            style={[
              a.text_xs,
              a.font_bold,
              {color: t.palette.primary_600, fontVariant: ['tabular-nums']},
            ]}>
            <Trans comment="Before a comment field: the second of the video the comment will be linked to, e.g. at 0:41">
              at {time}
            </Trans>
          </Text>
        </View>
        <Text
          style={[a.text_md, a.flex_shrink, t.atoms.text_contrast_medium]}
          numberOfLines={1}>
          {placeholder}
        </Text>
      </Pressable>
    </View>
  )
}
