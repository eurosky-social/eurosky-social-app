import {View} from 'react-native'
import {type ModerationOpts} from '@bsky/sdk/moderation'

import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'
import {findPublisherByDid} from '#/features/publishers/publishers'
import {type app} from '#/lexicons'

/** Publisher logo and name, then the topic. Neutral until publishers can theme it. */
export function Kicker({
  author,
  topic,
  format,
  moderationOpts,
}: {
  author: app.bsky.actor.defs.ProfileViewBasic
  topic?: string
  format?: string
  moderationOpts?: ModerationOpts
}) {
  const t = useTheme()
  const publisher = findPublisherByDid(author.did)
  const name = publisher?.name ?? author.displayName ?? author.handle
  const identity = (
    <>
      {moderationOpts && (
        <ProfileCard.Avatar
          profile={author}
          moderationOpts={moderationOpts}
          size={16}
          disabledPreview
          disableLink
        />
      )}
      <Text emoji numberOfLines={1} style={[a.text_sm, a.font_semi_bold]}>
        {name}
      </Text>
    </>
  )
  return (
    <View
      testID="newsCardKicker"
      pointerEvents="box-none"
      style={[a.flex_row, a.align_center, a.gap_sm, {minWidth: 0}]}>
      {publisher ? (
        <Link
          testID="newsCardPublisher"
          to={{screen: 'Publisher', params: {publisher: publisher.id}}}
          label={name}
          style={[a.flex_row, a.align_center, a.gap_xs, {minHeight: 24}]}>
          {identity}
        </Link>
      ) : (
        <View
          pointerEvents="none"
          style={[a.flex_row, a.align_center, a.gap_xs]}>
          {identity}
        </View>
      )}
      {(!!topic || !!format) && (
        <View
          testID="newsCardTopicGroup"
          pointerEvents="none"
          aria-hidden
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[a.flex_row, a.align_center, a.flex_shrink, {minWidth: 0}]}>
          {!!topic && (
            <Text
              emoji
              testID="newsCardTopic"
              numberOfLines={1}
              style={[
                a.text_sm,
                a.font_medium,
                a.pl_sm,
                a.border_l,
                t.atoms.text_contrast_medium,
                t.atoms.border_contrast_low,
              ]}>
              {topic}
            </Text>
          )}
          {!!format && (
            <Text
              numberOfLines={1}
              style={[
                a.text_sm,
                a.font_medium,
                a.pl_xs,
                t.atoms.text_contrast_medium,
              ]}>
              {`· ${format}`}
            </Text>
          )}
        </View>
      )}
    </View>
  )
}
