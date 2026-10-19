import {View} from 'react-native'
import {Image} from 'expo-image'
import {useLingui} from '@lingui/react/macro'

import {toNiceDomain} from '#/lib/strings/url-helpers'
import {atoms as a, useTheme} from '#/alf'
import {Link} from '#/components/Link'
import {Text} from '#/components/Typography'
import {type PostLink} from './media'

/** The same size as photo thumbnails in the text-first layout. */
export const OSO_THUMB_SIZE = 88

/**
 * A link preview for Oso's text-first layout: a thumbnail the size of the
 * photo thumbnails, with the title and site beside it, instead of the usual
 * full-width card.
 */
export function OsoLinkRow({
  link,
  onOpen,
}: {
  link: PostLink
  onOpen?: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const domain = toNiceDomain(link.uri)

  return (
    <Link
      label={link.title || l`Open link to ${domain}`}
      to={link.uri}
      shouldProxy={true}
      onPress={onOpen}
      style={[a.rounded_md, a.mb_xs]}>
      {({hovered}) => (
        <View
          style={[
            a.flex_row,
            a.align_center,
            a.gap_md,
            a.w_full,
            a.rounded_md,
            a.overflow_hidden,
            a.border,
            hovered
              ? t.atoms.border_contrast_high
              : t.atoms.border_contrast_low,
          ]}>
          {link.thumb ? (
            <Image
              accessibilityIgnoresInvertColors
              source={{uri: link.thumb}}
              contentFit="cover"
              style={{width: OSO_THUMB_SIZE, height: OSO_THUMB_SIZE}}
            />
          ) : null}
          <View style={[a.flex_1, a.gap_2xs, a.py_sm, !link.thumb && a.px_md]}>
            {link.title ? (
              <Text
                emoji
                numberOfLines={2}
                style={[a.text_sm, a.font_semi_bold, a.leading_snug]}>
                {link.title}
              </Text>
            ) : null}
            <Text
              numberOfLines={1}
              style={[a.text_xs, t.atoms.text_contrast_medium]}>
              {domain}
            </Text>
          </View>
        </View>
      )}
    </Link>
  )
}
