/**
 * Renders TeX math in post text: inline $x$ and display $$x$$ spans.
 *
 * Mirrors `#/components/RichTextCode`: inline math (and, in truncated
 * previews, display math) stays inside the parent RichText `<Text>`; in full
 * post views a display span becomes a `<View>` block that RichText splices
 * between prose `<Text>` runs. `#/lib/math/parse` is the tokenizer; `./Math`
 * is the platform-split renderer (KaTeX HTML on web, MathJax SVG on native).
 *
 * Opt-in: only used when RichText is given `enableMath` (post bodies).
 * RichText runs this on the prose left over after code parsing, so a `$`
 * inside a code span is never treated as a delimiter.
 */
import {parseMathTokens} from '#/lib/math/parse'
import {type CodePart as TextPart} from '#/components/RichTextCode'
import {MathBlock, MathInline} from './Math'

/**
 * Splits a run of text into parts. `blockMode` renders display math as a
 * `<View>` block (full views); otherwise every span stays inline (truncated
 * previews, where a block would break `numberOfLines`). `keyPrefix` keeps
 * element keys unique across a post's multiple text runs. `fontSize` is the
 * surrounding text's, so native can size its SVGs to match (web scales
 * through CSS em units and ignores it).
 */
export function parseMathParts(
  text: string,
  keyPrefix: string,
  blockMode: boolean,
  fontSize: number,
): TextPart[] {
  const tokens = parseMathTokens(text)
  // Blocks carry their own vertical margin. Trim a single newline from text
  // adjacent to one so an author's blank line around `$$` doesn't double the
  // gap. Safe to mutate: tokens are freshly created.
  if (blockMode) {
    tokens.forEach((tok, i) => {
      if (tok.type !== 'block') return
      const prev = tokens[i - 1]
      if (prev?.type === 'text') prev.value = prev.value.replace(/\n$/, '')
      const next = tokens[i + 1]
      if (next?.type === 'text') next.value = next.value.replace(/^\n/, '')
    })
  }
  return tokens.map((tok, i): TextPart => {
    if (tok.type === 'text') return {block: false, node: tok.value}
    const key = `${keyPrefix}:${i}`
    if (tok.type === 'inline' || !blockMode) {
      return {
        block: false,
        node: <MathInline key={key} tex={tok.value} fontSize={fontSize} />,
      }
    }
    return {
      block: true,
      node: <MathBlock key={key} tex={tok.value} fontSize={fontSize} />,
    }
  })
}
