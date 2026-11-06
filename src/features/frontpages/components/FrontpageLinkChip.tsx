import {type StyleProp, View, type ViewStyle} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useProfileQuery} from '#/state/queries/profile'
import {atoms as a, useTheme} from '#/alf'
import {Newspaper2_Stroke2_Corner2_Rounded as FrontpageIcon} from '#/components/icons/Newspaper2'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {readableAccent} from '#/features/news/accent'
import {getPublisherName} from '#/features/news/publishers'
import {
  findFrontpageByUrl,
  type Frontpage,
  frontpagePath,
  useFrontpages,
} from '../frontpages'

/**
 * A small pill rendered under a post's external link embed when the link
 * points at a frontpage's site, connecting the post back to that frontpage.
 * Renders nothing for other domains, and nothing at all without the news
 * aggregator, so call sites can include it unconditionally.
 */
export function FrontpageLinkChip({
  url,
  style,
}: {
  url: string
  style?: StyleProp<ViewStyle>
}) {
  const {frontpages} = useFrontpages()
  const frontpage = findFrontpageByUrl(frontpages, url)
  if (!frontpage) return null
  return <Chip frontpage={frontpage} style={style} />
}

/*
 * A separate component from the lookup so hooks only run for posts that
 * actually match a frontpage; the profile query supplies the live display name
 * of a frontpage with an account.
 */
function Chip({
  frontpage,
  style,
}: {
  frontpage: Frontpage
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {data: profile} = useProfileQuery({did: frontpage.did})
  const name = getPublisherName(profile) || frontpage.name
  const accent = readableAccent(frontpage.accent, t)

  return (
    <View style={[a.flex_row, style]}>
      <Link
        to={frontpagePath(frontpage)}
        label={name ? l`Visit the ${name} frontpage` : l`Visit this frontpage`}
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
            <FrontpageIcon size="xs" style={{color: accent}} />
            <Text
              emoji
              numberOfLines={1}
              style={[a.text_xs, a.font_bold, a.leading_snug, {color: accent}]}>
              {name ? (
                <Trans>{name} Frontpage</Trans>
              ) : (
                <Trans>Frontpage</Trans>
              )}
            </Text>
          </View>
        )}
      </Link>
    </View>
  )
}
