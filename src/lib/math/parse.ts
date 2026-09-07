/**
 * Splits a run of post text into plain text, inline math ($x$) and display
 * math ($$x$$). Used by `#/components/RichTextMath` to render TeX in post
 * bodies, the same way `#/lib/code/parse` feeds `RichTextCode`.
 *
 * Dollar signs are common in prose (prices), so the inline form follows the
 * Pandoc rules to keep false positives down: the opening `$` must be followed
 * by a non-space character, the closing `$` must be preceded by one and must
 * not be followed by a digit, and the span cannot cross a line break. So
 * "$5 and $10" is text while "$x$ and $y$" is math. `\$` is an escaped dollar
 * and never starts or ends a span; it renders as a plain `$` once the post is
 * known to contain math (see `hasMath`), and is left untouched otherwise.
 */
export type MathToken =
  | {type: 'text'; value: string}
  | {type: 'inline'; value: string}
  | {type: 'block'; value: string}

// Order matters: the escape must come first so `\$` can never open a span,
// and the display form must precede the inline form so `$$` is never read as
// an empty inline span.
//   1. \$              -> literal dollar (no group)
//   2. $$ body $$      -> display math, may span lines (group 1)
//   3. $ body $        -> inline math, single line (group 2)
const MATH_RE = /\\\$|\$\$([\s\S]+?)\$\$|\$(?=\S)([^$\n]*?[^\s$])\$(?!\d)/g

export function parseMathTokens(text: string): MathToken[] {
  const tokens: MathToken[] = []
  const pushText = (value: string) => {
    const prev = tokens[tokens.length - 1]
    if (prev?.type === 'text') {
      prev.value += value
    } else {
      tokens.push({type: 'text', value})
    }
  }
  let last = 0
  let m: RegExpExecArray | null
  MATH_RE.lastIndex = 0
  while ((m = MATH_RE.exec(text))) {
    if (m.index > last) {
      pushText(text.slice(last, m.index))
    }
    if (m[1] !== undefined) {
      // A display span with nothing but whitespace inside is not math.
      const value = m[1].trim()
      if (value) {
        tokens.push({type: 'block', value})
      } else {
        pushText(m[0])
      }
    } else if (m[2] !== undefined) {
      tokens.push({type: 'inline', value: m[2]})
    } else {
      pushText('$')
    }
    last = MATH_RE.lastIndex
  }
  if (last < text.length) {
    pushText(text.slice(last))
  }
  return tokens
}

/**
 * True if `text` contains at least one inline or display math span. Escaped
 * dollars alone do not count, so a post that only uses `\$` renders verbatim.
 */
export function hasMath(text: string): boolean {
  if (!text.includes('$')) return false
  let m: RegExpExecArray | null
  MATH_RE.lastIndex = 0
  while ((m = MATH_RE.exec(text))) {
    if (m[2] !== undefined || (m[1] !== undefined && m[1].trim())) {
      MATH_RE.lastIndex = 0
      return true
    }
  }
  return false
}
