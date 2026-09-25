import {useEffect} from 'react'
import {View} from 'react-native'
import {RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {Plural, Trans, useLingui} from '@lingui/react/macro'
import {useIsFocused} from '@react-navigation/native'

import {useNonReactiveCallback} from '#/lib/hooks/useNonReactiveCallback'
import {useOpenComposer} from '#/lib/hooks/useOpenComposer'
import {sanitizeDisplayName} from '#/lib/strings/display-names'
import {sanitizeHandle} from '#/lib/strings/handles'
import {postUriToRelativePath} from '#/lib/strings/url-helpers'
import {type ThreadItem, usePostThread} from '#/state/queries/usePostThread'
import {useSession} from '#/state/session'
import {type OnPostSuccessData} from '#/state/shell/composer'
import {List} from '#/view/com/util/List'
import {TimeElapsed} from '#/view/com/util/TimeElapsed'
import {PreviewableUserAvatar} from '#/view/com/util/UserAvatar'
import {ThreadComposePrompt} from '#/screens/PostThread/components/ThreadComposePrompt'
import {atoms as a, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {Heart2_Stroke2_Corner0_Rounded as Heart} from '#/components/icons/Heart2'
import {InlineLinkText} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {ContentHider} from '#/components/moderation/ContentHider'
import {PostAlerts} from '#/components/moderation/PostAlerts'
import {RichText} from '#/components/RichText'
import {Text} from '#/components/Typography'
import {getLiveEventState, type LiveEvent} from '../events'

/** How often the thread refetches while the event is live. */
const LIVE_POLL_MS = 15_000

type LiveThreadPost = Extract<ThreadItem, {type: 'threadPost'}>

/**
 * Why the thread has nothing to show. The empty state's copy is keyed on
 * this, so the title and body can never disagree.
 */
export type LiveThreadEmptyReason =
  'no-anchor' | 'not-yet' | 'unavailable' | 'signed-out' | 'no-replies'

/**
 * The replies under the anchor post, newest first and flattened, so the
 * thread reads like a chat while staying ordinary posts. Refetches on an
 * interval while the event is live (or while the anchor is still being
 * indexed) and the screen is focused.
 */
export function useLiveThread({
  event,
  anchorUri,
  anchorLoading = false,
}: {
  event: LiveEvent
  anchorUri: string | null
  anchorLoading?: boolean
}) {
  const {hasSession} = useSession()
  const thread = usePostThread({
    anchor: anchorUri ?? undefined,
    initialView: 'linear',
  })
  const isFocused = useIsFocused()
  const isLive = getLiveEventState(event) === 'live'
  const refetch = thread.actions.refetch

  const anchorItem = thread.data.items.find(
    item => 'depth' in item && item.depth === 0,
  )
  const anchor = anchorItem?.type === 'threadPost' ? anchorItem : undefined
  /*
   * The anchor comes from the PDS the moment it is posted, the thread from
   * the appview a little later, so a fresh post shows up as not found for a
   * while. Real failures land here too and are retried the same way.
   */
  const unavailable =
    !!anchorUri &&
    !anchor &&
    (anchorItem?.type === 'threadPostNotFound' ||
      anchorItem?.type === 'threadPostBlocked' ||
      !!thread.state.error)

  useEffect(() => {
    if (!anchorUri || !isFocused || !(isLive || unavailable)) return
    const id = setInterval(() => {
      void refetch()
    }, LIVE_POLL_MS)
    return () => clearInterval(id)
  }, [anchorUri, isLive, unavailable, isFocused, refetch])

  /*
   * Replies from accounts that hide from logged-out viewers arrive as a
   * different item type; count them so the empty state can say so.
   */
  const hiddenWhileLoggedOut = thread.data.items.filter(
    item => item.type === 'threadPostNoUnauthenticated' && item.depth > 0,
  ).length

  const replies: LiveThreadPost[] = thread.data.items
    .filter(
      (item): item is LiveThreadPost =>
        item.type === 'threadPost' && item.depth > 0,
    )
    .sort(
      (x, y) =>
        new Date(y.value.post.indexedAt).getTime() -
        new Date(x.value.post.indexedAt).getTime(),
    )

  const {openComposer} = useOpenComposer()
  const insertReplies = thread.actions.insertReplies
  const onPostSuccess = useNonReactiveCallback((payload: OnPostSuccessData) => {
    if (payload?.replyToUri && payload.posts.length) {
      insertReplies(payload.replyToUri, payload.posts)
    }
  })
  const replyTo = useNonReactiveCallback((item: LiveThreadPost) => {
    const post = item.value.post
    openComposer({
      replyTo: {
        uri: item.uri,
        cid: post.cid,
        text: post.record.text,
        author: post.author,
        embed: post.embed,
        moderation: item.moderation,
        langs: post.record.langs,
      },
      onPostSuccess,
      logContext: 'PostReply',
    })
  })
  const onReply = useNonReactiveCallback(() => {
    if (anchor) replyTo(anchor)
  })

  // The composer needs a session, whatever the thread gate says.
  const canReply =
    hasSession && !!anchor && !anchor.value.post.viewer?.replyDisabled

  // Placeholder items stand in for the anchor while it loads.
  const isLoading =
    anchorLoading || (!!anchorUri && thread.state.isPlaceholderData)

  let emptyReason: LiveThreadEmptyReason | null = null
  if (!anchorUri) {
    emptyReason =
      getLiveEventState(event) === 'upcoming' ? 'not-yet' : 'no-anchor'
  } else if (unavailable) {
    emptyReason = 'unavailable'
  } else if (replies.length === 0) {
    emptyReason = hiddenWhileLoggedOut > 0 ? 'signed-out' : 'no-replies'
  }

  return {
    anchor,
    replies,
    canReply,
    hiddenWhileLoggedOut,
    emptyReason,
    isLoading,
    onReply,
    replyTo,
  }
}

type LiveThreadData = ReturnType<typeof useLiveThread>

function roleOf(event: LiveEvent, did: string): 'host' | 'speaker' | null {
  if (did === event.hostDid) return 'host'
  if (event.speakerDids?.includes(did)) return 'speaker'
  return null
}

function RoleChip({role}: {role: 'host' | 'speaker'}) {
  const t = useTheme()
  return (
    <View
      style={[
        a.rounded_xs,
        a.px_xs,
        {paddingVertical: 1, backgroundColor: t.palette.primary_100},
      ]}>
      <Text
        style={[
          a.text_2xs,
          a.font_bold,
          {color: t.palette.primary_800, letterSpacing: 0.4},
        ]}>
        {role === 'host' ? (
          <Trans comment="Chip on the event host's reply">HOST</Trans>
        ) : (
          <Trans comment="Chip on a speaker's reply">SPEAKER</Trans>
        )}
      </Text>
    </View>
  )
}

/**
 * One post in the thread, compact: avatar, name, role chip, time, text and
 * two small actions. Reads like a chat row rather than a feed item, and
 * keeps its height low so a fast thread stays scannable.
 */
export function LiveThreadRow({
  event,
  item,
  pinned = false,
  onReplyTo,
}: {
  event: LiveEvent
  item: LiveThreadPost
  /** The anchor post: tinted and labelled as the thread's origin. */
  pinned?: boolean
  onReplyTo?: (item: LiveThreadPost) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const post = item.value.post
  const author = post.author
  const moderation = item.moderation
  const role = roleOf(event, author.did)
  const displayName = sanitizeDisplayName(
    author.displayName || sanitizeHandle(author.handle),
    moderation.ui('displayName'),
  )
  const path = postUriToRelativePath(post.uri, {handle: author.handle})
  const contentModui = moderation.ui('contentView')
  const richText = new RichTextAPI({
    text: post.record.text,
    facets: post.record.facets,
  })
  const tint = pinned || role
  const canReply = !!onReplyTo && !post.viewer?.replyDisabled

  return (
    <View
      style={[
        a.flex_row,
        a.gap_sm,
        a.px_lg,
        a.py_sm,
        a.border_b,
        t.atoms.border_contrast_low,
        tint && {backgroundColor: t.palette.primary_25},
      ]}>
      <PreviewableUserAvatar
        profile={author}
        moderation={moderation.ui('avatar')}
        size={32}
      />
      <View style={[a.flex_1, a.gap_2xs]}>
        <View style={[a.flex_row, a.align_center, a.gap_xs, a.flex_wrap]}>
          <Text
            emoji
            numberOfLines={1}
            style={[a.text_sm, a.font_bold, t.atoms.text, {flexShrink: 1}]}>
            {displayName}
          </Text>
          {pinned ? <RoleChip role="host" /> : role && <RoleChip role={role} />}
          <TimeElapsed timestamp={post.indexedAt}>
            {({timeElapsed}) =>
              path ? (
                <InlineLinkText
                  to={path}
                  label={l`Open this post`}
                  style={[a.text_xs, t.atoms.text_contrast_medium]}>
                  {timeElapsed}
                </InlineLinkText>
              ) : (
                <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                  {timeElapsed}
                </Text>
              )
            }
          </TimeElapsed>
        </View>
        <ContentHider modui={contentModui} childContainerStyle={[a.gap_2xs]}>
          <PostAlerts modui={contentModui} />
          {!!richText.text && (
            <RichText
              enableTags
              value={richText}
              style={[a.text_sm, a.leading_snug, t.atoms.text]}
            />
          )}
        </ContentHider>
        {(canReply || !!post.likeCount) && (
          <View style={[a.flex_row, a.align_center, a.gap_lg, a.pt_2xs]}>
            {canReply && (
              <Button
                label={l`Reply to ${displayName}`}
                onPress={() => onReplyTo?.(item)}
                style={[a.self_start]}>
                <Text
                  style={[
                    a.text_xs,
                    a.font_semi_bold,
                    t.atoms.text_contrast_medium,
                  ]}>
                  <Trans context="action">Reply</Trans>
                </Text>
              </Button>
            )}
            {!!post.likeCount && (
              <View style={[a.flex_row, a.align_center, a.gap_2xs]}>
                <Heart size="xs" style={[t.atoms.text_contrast_medium]} />
                <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
                  {post.likeCount}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  )
}

export function LiveThreadEmpty({
  reason,
  hiddenWhileLoggedOut = 0,
}: {
  reason: LiveThreadEmptyReason
  hiddenWhileLoggedOut?: number
}) {
  const t = useTheme()
  let title: React.ReactNode
  let body: React.ReactNode
  switch (reason) {
    case 'no-anchor':
      title = <Trans>No discussion thread yet</Trans>
      body = (
        <Trans>
          The live thread is the replies to the host's post of this stream.
        </Trans>
      )
      break
    case 'not-yet':
      title = <Trans>The thread opens when the host posts the stream</Trans>
      body = (
        <Trans>
          The live thread is the replies to the host's post of this stream.
        </Trans>
      )
      break
    case 'unavailable':
      title = <Trans>The thread is not available yet</Trans>
      body = (
        <Trans>
          The host's post has not been indexed yet. This page keeps checking.
        </Trans>
      )
      break
    case 'signed-out':
      title = <Trans>Sign in to see the replies</Trans>
      body = (
        <Plural
          value={hiddenWhileLoggedOut}
          one="# reply is only shown to signed-in viewers."
          other="# replies are only shown to signed-in viewers."
        />
      )
      break
    case 'no-replies':
      title = <Trans>No replies yet</Trans>
      body = <Trans>Be the first to say something.</Trans>
      break
  }
  return (
    <View style={[a.px_lg, a.py_2xl, a.align_center, a.gap_xs]}>
      <Text style={[a.text_md, a.font_bold, a.text_center, t.atoms.text]}>
        {title}
      </Text>
      <Text
        style={[
          a.text_sm,
          a.text_center,
          a.leading_snug,
          t.atoms.text_contrast_medium,
        ]}>
        {body}
      </Text>
    </View>
  )
}

/**
 * The thread rendered inline inside a scrolling screen (phone), with the
 * compose prompt supplied by the screen so it can stay pinned.
 */
export function LiveThreadInline({
  event,
  data,
}: {
  event: LiveEvent
  data: LiveThreadData
}) {
  const t = useTheme()
  if (data.isLoading) {
    return (
      <View style={[a.py_2xl, a.align_center]}>
        <Loader size="lg" />
      </View>
    )
  }
  return (
    <View style={[a.border_t, t.atoms.border_contrast_low]}>
      {data.anchor && <LiveThreadRow event={event} item={data.anchor} pinned />}
      {data.emptyReason ? (
        <LiveThreadEmpty
          reason={data.emptyReason}
          hiddenWhileLoggedOut={data.hiddenWhileLoggedOut}
        />
      ) : (
        data.replies.map(item => (
          <LiveThreadRow
            key={item.key}
            event={event}
            item={item}
            onReplyTo={data.replyTo}
          />
        ))
      )}
    </View>
  )
}

/**
 * The thread as its own scrolling column (desktop split view): header, the
 * host's post pinned, the replies, and the compose prompt at the bottom.
 */
export function LiveThreadPanel({
  event,
  anchorUri,
  anchorLoading,
}: {
  event: LiveEvent
  anchorUri: string | null
  anchorLoading: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const data = useLiveThread({event, anchorUri, anchorLoading})
  const count = data.anchor?.value.post.replyCount ?? data.replies.length

  return (
    <View style={[a.flex_1, {minHeight: 0}]}>
      <View
        style={[
          a.flex_row,
          a.align_center,
          a.justify_between,
          a.px_lg,
          a.py_md,
          a.border_b,
          t.atoms.border_contrast_low,
        ]}>
        <Text style={[a.text_md, a.font_bold, t.atoms.text]}>
          <Trans>Live thread</Trans>
        </Text>
        {data.anchor && (
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            {l`${count} replies`}
          </Text>
        )}
      </View>
      {data.isLoading ? (
        <View style={[a.flex_1, a.py_2xl, a.align_center]}>
          <Loader size="lg" />
        </View>
      ) : (
        <List
          data={data.replies}
          keyExtractor={(item: LiveThreadPost) => item.key}
          ListHeaderComponent={
            data.anchor ? (
              <LiveThreadRow event={event} item={data.anchor} pinned />
            ) : null
          }
          ListEmptyComponent={
            data.emptyReason ? (
              <LiveThreadEmpty
                reason={data.emptyReason}
                hiddenWhileLoggedOut={data.hiddenWhileLoggedOut}
              />
            ) : null
          }
          renderItem={({item}) => (
            <LiveThreadRow event={event} item={item} onReplyTo={data.replyTo} />
          )}
          style={[a.flex_1]}
          desktopFixedHeight
        />
      )}
      {data.canReply && <ThreadComposePrompt onPressCompose={data.onReply} />}
    </View>
  )
}
