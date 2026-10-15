import {useState} from 'react'
import {View} from 'react-native'

import {countLines} from '#/lib/strings/helpers'
import {type TextStyleProp} from '#/alf'
import {Text} from '#/components/Typography'
import {ShowMoreButton} from './ShowMoreButton'

/**
 * Plain text cut off at `numberOfLines`, with a “Show more” button that
 * reveals the rest.
 */
export function CollapsibleText({
  children,
  numberOfLines,
  maxChars,
  expandLabel,
  style,
}: {
  children: string
  numberOfLines: number
  /**
   * We can't cheaply measure whether wrapped text overflows (onTextLayout
   * doesn't fire on web), so long text without line breaks is caught by
   * length.
   */
  maxChars: number
  /** Accessibility label of the “Show more” button. */
  expandLabel: string
} & TextStyleProp) {
  const [collapsed, setCollapsed] = useState(
    () => countLines(children) >= numberOfLines || children.length > maxChars,
  )

  // The button sits below the text, so this can't return <Text> itself.
  // oxlint-disable-next-line bsky-internal/avoid-unwrapped-text
  return (
    <View>
      <Text
        emoji
        numberOfLines={collapsed ? numberOfLines : undefined}
        style={style}>
        {children}
      </Text>
      {collapsed && (
        <ShowMoreButton
          label={expandLabel}
          onPress={() => setCollapsed(false)}
        />
      )}
    </View>
  )
}
