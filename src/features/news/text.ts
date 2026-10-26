/**
 * Flattens multi-line user text into one paragraph for clamped previews
 * (publisher bio, discussion post snippets). Hard line breaks inside a
 * `numberOfLines` clamp can leave the truncation ellipsis stranded alone on
 * an otherwise-empty line; collapsing whitespace keeps it glued to the text.
 */
export function toSingleParagraph(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}
