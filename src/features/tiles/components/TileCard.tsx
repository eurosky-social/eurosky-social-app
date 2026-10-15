import {type StyleProp, View, type ViewStyle} from 'react-native'
import {Image} from 'expo-image'

import {toNiceDomain} from '#/lib/strings/url-helpers'
import {atoms as a, useTheme} from '#/alf'
import {Divider} from '#/components/Divider'
import {Play_Filled_Corner0_Rounded as PlayIcon} from '#/components/icons/Play'
import {Loader} from '#/components/Loader'
import {Text} from '#/components/Typography'
import {BRAND} from '#/config/brand'
import {type app} from '#/lexicons'

/**
 * The host shown in the card footer. A posted tile card links to the post on
 * our own host; in the composer preview the link is still the tile's at-URI,
 * so show the host the card will end up linking to.
 */
export function tileCardHost(uri: string): string {
  return /^https?:\/\//.test(uri) ? toNiceDomain(uri) : BRAND.web.hosts[0]
}

/**
 * The link card of a tile post. Looks like an external link card, with the
 * screenshot (play button included) where the thumbnail goes, or, once the
 * tile is running, the tile itself in `media`.
 */
export function TileCard({
  link,
  hovered = false,
  pressed = false,
  loading = false,
  media,
  action,
  style,
}: {
  link: app.bsky.embed.external.ViewExternal
  hovered?: boolean
  pressed?: boolean
  /** Dims the screenshot behind a spinner while the tile loads. */
  loading?: boolean
  /** Replaces the screenshot: the running tile. */
  media?: React.ReactNode
  /** Sits at the end of the footer row, e.g. a close button. */
  action?: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const t = useTheme()
  const hasMedia = Boolean(media || link.thumb)
  const borderColor = hovered
    ? t.atoms.border_contrast_high
    : t.atoms.border_contrast_low

  return (
    <View
      style={[
        a.transition_color,
        a.flex_col,
        a.rounded_md,
        a.overflow_hidden,
        a.w_full,
        a.border,
        pressed && t.atoms.bg,
        style,
        borderColor,
      ]}>
      {media ? (
        media
      ) : link.thumb ? (
        <View>
          <Image
            style={[a.aspect_card]}
            source={{uri: link.thumb}}
            accessibilityIgnoresInvertColors
            loading="lazy"
            useAppleWebpCodec
          />
          {loading && (
            <View
              style={[
                a.align_center,
                a.justify_center,
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.35)',
                },
              ]}>
              <Loader size="xl" />
            </View>
          )}
        </View>
      ) : null}

      <View
        style={[
          a.flex_1,
          a.pt_sm,
          {gap: 3},
          hasMedia && a.border_t,
          borderColor,
        ]}>
        <View style={[{gap: 3}, a.pb_xs, a.px_md]}>
          <Text
            emoji
            numberOfLines={3}
            style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
            {link.title || link.uri}
          </Text>
          {link.description ? (
            <Text
              emoji
              numberOfLines={hasMedia ? 2 : 4}
              style={[a.text_sm, a.leading_snug]}>
              {link.description}
            </Text>
          ) : null}
        </View>
        <View style={[a.px_md]}>
          <Divider />
          <View
            style={[
              a.flex_row,
              a.align_center,
              a.gap_2xs,
              a.pb_sm,
              {
                paddingTop: 6, // off menu
              },
            ]}>
            <PlayIcon
              size="xs"
              style={[
                a.transition_color,
                hovered
                  ? t.atoms.text_contrast_medium
                  : t.atoms.text_contrast_low,
              ]}
            />
            <Text
              numberOfLines={1}
              style={[
                a.flex_1,
                a.transition_color,
                a.text_xs,
                a.leading_snug,
                hovered
                  ? t.atoms.text_contrast_high
                  : t.atoms.text_contrast_medium,
              ]}>
              {tileCardHost(link.uri)}
            </Text>
            {action}
          </View>
        </View>
      </View>
    </View>
  )
}
