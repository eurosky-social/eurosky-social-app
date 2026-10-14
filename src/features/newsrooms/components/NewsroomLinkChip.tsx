import {type StyleProp, View, type ViewStyle} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useProfileQuery} from '#/state/queries/profile'
import {atoms as a, useTheme} from '#/alf'
import {Newspaper2_Stroke2_Corner2_Rounded as NewsroomIcon} from '#/components/icons/Newspaper2'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {readableAccent} from '../accent'
import {
  findNewsroomByUrl,
  type Newsroom,
  newsroomPath,
  useNewsrooms,
} from '../newsrooms'
import {getPublisherName} from '../publishers'

/**
 * A small pill rendered under a post's external link embed when the link
 * points at a newsroom's site, connecting the post back to that newsroom.
 * Renders nothing for other domains, and nothing at all without the news
 * aggregator, so call sites can include it unconditionally.
 */
export function NewsroomLinkChip({
  url,
  style,
}: {
  url: string
  style?: StyleProp<ViewStyle>
}) {
  const {newsrooms} = useNewsrooms()
  const newsroom = findNewsroomByUrl(newsrooms, url)
  if (!newsroom) return null
  return <Chip newsroom={newsroom} style={style} />
}

/*
 * A separate component from the lookup so hooks only run for posts that
 * actually match a newsroom; the profile query supplies the live display name
 * of a newsroom with an account.
 */
function Chip({
  newsroom,
  style,
}: {
  newsroom: Newsroom
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {data: profile} = useProfileQuery({did: newsroom.did})
  const name = getPublisherName(profile) || newsroom.name
  const accent = readableAccent(newsroom.accent, t)

  return (
    <View style={[a.flex_row, style]}>
      <Link
        to={newsroomPath(newsroom)}
        label={name ? l`Visit the ${name} newsroom` : l`Visit this newsroom`}
        style={[a.rounded_full]}>
        {({hovered, pressed}) => (
          <View
            style={[
              a.flex_row,
              a.align_center,
              a.gap_xs,
              a.rounded_full,
              a.border,
              a.px_sm,
              a.py_2xs,
              a.transition_color,
              hovered || pressed
                ? {borderColor: accent + '80', backgroundColor: accent + '26'}
                : {borderColor: accent + '4D', backgroundColor: accent + '14'},
            ]}>
            <NewsroomIcon size="xs" style={{color: accent}} />
            <Text
              emoji
              numberOfLines={1}
              style={[a.text_xs, a.font_bold, a.leading_snug, {color: accent}]}>
              {name ? <Trans>{name} Newsroom</Trans> : <Trans>Newsroom</Trans>}
            </Text>
          </View>
        )}
      </Link>
    </View>
  )
}
