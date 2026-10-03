type FoundEmoji = {
  value: string
  index: number
}

/**
 * Finds an emoji shortcode query at the cursor. Shortcodes only start at the
 * beginning of the text or after whitespace, which avoids matching URL ports
 * and ordinary punctuation.
 */
export function getEmojiAt(
  text: string,
  cursorPos: number,
): FoundEmoji | undefined {
  const re = /(^|\s):([a-z0-9_+-]*)/gi
  let match

  while ((match = re.exec(text))) {
    const whitespaceOffset = match[1].length
    const index = match.index + whitespaceOffset
    const matchLength = match[0].length - whitespaceOffset
    const matchEnd = index + matchLength

    /*
     * onChangeText fires before onSelectionChange on native. Check the text,
     * rather than the cursor, so a newly typed closing colon always dismisses
     * the active autocomplete.
     */
    if (text[matchEnd] === ':') continue

    if (cursorPos >= index && cursorPos <= matchEnd) {
      return {value: match[2], index}
    }
  }

  return undefined
}

/** Replaces the emoji shortcode query at the cursor with a Unicode emoji. */
export function insertEmojiAt(
  text: string,
  cursorPos: number,
  emoji: string,
): string {
  const target = getEmojiAt(text, cursorPos)
  if (!target) return text

  const targetEnd = target.index + target.value.length + 1
  const suffix = text.slice(targetEnd)
  const trailingSpace = suffix.length === 0 || !/^\s/.test(suffix) ? ' ' : ''

  return `${text.slice(0, target.index)}${emoji}${trailingSpace}${suffix}`
}
