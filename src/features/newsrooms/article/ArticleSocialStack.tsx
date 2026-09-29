import {View} from 'react-native'
import {Plural} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {AvatarStack} from '#/components/AvatarStack'
import {Text} from '#/components/Typography'
import {type app} from '#/lexicons'

const SHOWN_AVATARS = 3

/**
 * Who in the network shared this article, as a face pile plus a count - the
 * same social-proof row the notifications list and a profile's mutual followers
 * use.
 *
 * The sharers are the authors of the article's discussion posts. When any of
 * them are people the reader follows, the row is about those connections; with
 * none followed it falls back to the wider count rather than naming strangers
 * as connections.
 */
export function ArticleSocialStack({
  authors,
}: {
  authors: app.bsky.actor.defs.ProfileViewBasic[]
}) {
  const t = useTheme()

  // One row per person, not per post: an account that posted twice is one
  // sharer, and its avatar must not appear twice in the pile.
  const byDid = new Map<string, app.bsky.actor.defs.ProfileViewBasic>()
  for (const author of authors) {
    if (!byDid.has(author.did)) byDid.set(author.did, author)
  }
  const unique = [...byDid.values()]
  const followed = unique.filter(author => author.viewer?.following)

  const shown = followed.length > 0 ? followed : unique
  if (shown.length === 0) return null

  return (
    <View style={[a.flex_row, a.align_center, a.gap_sm]}>
      <AvatarStack profiles={shown.slice(0, SHOWN_AVATARS)} size={24} />
      <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
        {followed.length > 0 ? (
          <Plural
            value={followed.length}
            one="Shared by # connection"
            other="Shared by # connections"
          />
        ) : (
          <Plural
            value={unique.length}
            one="Shared by # person"
            other="Shared by # people"
          />
        )}
      </Text>
    </View>
  )
}
