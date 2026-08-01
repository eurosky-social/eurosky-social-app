import {type StyleProp, View, type ViewStyle} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useProfileQuery} from '#/state/queries/profile'
import {atoms as a, useTheme} from '#/alf'
import {Newspaper2_Stroke2_Corner2_Rounded as NewsroomIcon} from '#/components/icons/Newspaper2'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {
  getNewsroomPublisherByUrl,
  getPublisherName,
  type NewsroomPublisher,
} from '../publishers'

/**
 * A small pill rendered under a post's external link embed when the link
 * points at a registered publisher's site, connecting the post back to that
 * org's newsroom. Renders nothing for unregistered domains, so call sites can
 * include it unconditionally.
 */
export function NewsroomLinkChip({
  url,
  style,
}: {
  url: string
  style?: StyleProp<ViewStyle>
}) {
  const publisher = getNewsroomPublisherByUrl(url)
  if (!publisher) return null
  return <Chip publisher={publisher} style={style} />
}

/*
 * A separate component from the lookup so hooks only run for posts that
 * actually match a publisher; the profile query supplies the org's live
 * display name.
 */
function Chip({
  publisher,
  style,
}: {
  publisher: NewsroomPublisher
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {data: profile} = useProfileQuery({did: publisher.did})
  const name = getPublisherName(profile)
  const accent = publisher.accent ?? t.palette.primary_500

  return (
    <View style={[a.flex_row, style]}>
      <Link
        to={`/newsroom/${publisher.did}`}
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
