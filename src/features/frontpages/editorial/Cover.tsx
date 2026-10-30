import {Image} from 'expo-image'
import {type ModerationDecision} from '@bsky/sdk/moderation'

import {atoms as a, useTheme} from '#/alf'

/**
 * The account's banner across the top of the front page, edge to edge of the
 * spread. Shown only where the owner turned it on, and never for a banner the
 * reader's moderation would blur.
 */
export function Cover({
  banner,
  moderation,
  wide,
}: {
  banner?: string
  moderation: ModerationDecision
  wide: boolean
}) {
  const t = useTheme()
  if (!banner || moderation.ui('banner').blur) return null
  /* Bleeds over the column's own padding, so the photo fills the spread. */
  const bleed = (wide ? a.px_2xl : a.px_lg).paddingLeft
  return (
    <Image
      testID="frontpageCover"
      source={{uri: banner}}
      contentFit="cover"
      accessibilityIgnoresInvertColors
      style={[
        t.atoms.bg_contrast_25,
        {marginHorizontal: -bleed, aspectRatio: 3},
      ]}
    />
  )
}
