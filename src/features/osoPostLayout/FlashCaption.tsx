import {useState} from 'react'
import {View} from 'react-native'
import {type RichText as RichTextAPI} from '@bsky/sdk/richtext'
import {Trans, useLingui} from '@lingui/react/macro'

import {countLines} from '#/lib/strings/helpers'
import {atoms as a, useTheme, web} from '#/alf'
import {RichText} from '#/components/RichText'
import {Text} from '#/components/Typography'

/** Lines of text shown under a picture before "read more". */
const FLASH_LINES = 3
/** Longer than this probably wraps past the clamp, even without line breaks. */
const FLASH_CHARS = 180

/**
 * A post's text in the image-first layout (as in Flashes): under the picture
 * and buttons, clamped to a few lines with "read more" to show the rest.
 */
export function OsoFlashCaption({
  richText,
  authorHandle,
}: {
  richText: RichTextAPI
  authorHandle: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const [clamped, setClamped] = useState(
    () =>
      countLines(richText.text) >= FLASH_LINES ||
      richText.text.length > FLASH_CHARS,
  )

  if (!richText.text) return null

  return (
    <View style={[a.pb_sm]}>
      <RichText
        enableTags
        testID="postText"
        value={richText}
        numberOfLines={clamped ? FLASH_LINES : undefined}
        style={[a.text_md, a.leading_snug]}
        authorHandle={authorHandle}
        shouldProxyLinks={true}
      />
      {clamped && (
        <Text
          role="button"
          accessibilityRole="button"
          accessibilityLabel={l`Read the whole post`}
          accessibilityHint=""
          onPress={e => {
            // Expand in place rather than opening the post.
            e.stopPropagation()
            setClamped(false)
          }}
          style={[
            a.pt_2xs,
            a.text_md,
            a.font_semi_bold,
            t.atoms.text_contrast_medium,
            web({cursor: 'pointer'}),
          ]}>
          <Trans comment="Expands a clamped post's text in the image-first layout">
            read more
          </Trans>
        </Text>
      )}
    </View>
  )
}
