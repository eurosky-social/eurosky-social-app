import {Fragment} from 'react'
import {View} from 'react-native'
import {moderatePost} from '@bsky/sdk/moderation'
import {Plural, Trans, useLingui} from '@lingui/react/macro'

import {useModerationOpts} from '#/state/preferences/moderation-opts'
import {atoms as a, useTheme} from '#/alf'
import {Divider} from '#/components/Divider'
import {Link} from '#/components/Link'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {DiscussionPost} from '#/features/newsrooms/components/ArticleDiscussion'
import {articleSearchPath} from '#/features/newsrooms/discussion'
import {type LiveEvent} from '../events'
import {isInLiveThread, useLiveDiscussionQuery} from '../queries'

/**
 * Posts across the network that link the stream but were written outside
 * the Live section. Same shape as a newsroom's "This story in the
 * Atmosphere": a capped list here, the full set behind a search.
 */
export function NetworkDiscussion({
  event,
  anchorUri,
  limit = 6,
  compact = false,
}: {
  event: LiveEvent
  anchorUri: string | null
  /** How many posts to show before the "see all" link. */
  limit?: number
  /** Tighter header for the desktop column. */
  compact?: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const moderationOpts = useModerationOpts()
  const {data, isLoading} = useLiveDiscussionQuery(event)

  const header = (
    <Text style={[compact ? a.text_sm : a.text_md, a.font_bold, t.atoms.text]}>
      <Trans>Across the network</Trans>
    </Text>
  )

  // Moderation preferences can land after the search does.
  if (isLoading || !moderationOpts) {
    return (
      <View style={[a.px_lg, a.py_md, a.gap_md]}>
        {header}
        <View style={[a.py_lg, a.align_center]}>
          <Loader size="md" />
        </View>
      </View>
    )
  }

  const posts = (data ?? [])
    .filter(post => !isInLiveThread(post, anchorUri))
    .map(post => ({post, moderation: moderatePost(post, moderationOpts)}))
    .filter(({moderation}) => !moderation.ui('contentList').filter)
  const shown = posts.slice(0, limit)

  return (
    <View style={[a.px_lg, a.py_md, a.gap_md]}>
      <View style={[a.flex_row, a.align_baseline, a.justify_between]}>
        {header}
        {posts.length > 0 && (
          <Text style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Plural value={posts.length} one="# post" other="# posts" />
          </Text>
        )}
      </View>

      {shown.length === 0 ? (
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            Nobody outside the live thread has shared this stream yet.
          </Trans>
        </Text>
      ) : (
        <View
          style={[
            a.rounded_md,
            a.border,
            a.p_md,
            a.gap_md,
            t.atoms.border_contrast_low,
            t.atoms.bg_contrast_25,
          ]}>
          {shown.map(({post, moderation}, i) => (
            <Fragment key={post.uri}>
              {i > 0 && <Divider />}
              <DiscussionPost post={post} moderation={moderation} />
            </Fragment>
          ))}
        </View>
      )}

      {posts.length > 0 && (
        <Link
          to={articleSearchPath(event.streamUrl)}
          label={l`See all posts sharing this stream`}
          style={[a.self_start]}>
          <Text
            style={[a.text_sm, a.font_bold, {color: t.palette.primary_500}]}>
            {posts.length > shown.length ? (
              <Trans>
                See all{' '}
                <Plural value={posts.length} one="# post" other="# posts" />
              </Trans>
            ) : (
              <Trans>Open in search</Trans>
            )}
          </Text>
        </Link>
      )}
    </View>
  )
}
