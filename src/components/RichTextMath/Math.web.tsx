/**
 * Web math renderers backed by KaTeX, rendered client-side.
 *
 * KaTeX (~280KB of JS, plus its stylesheet and ~20 font faces) is split into
 * its own chunk and only fetched the first time a post with math is rendered;
 * the browser then pulls individual font files on demand as glyphs need them.
 * Until the chunk arrives the TeX source is shown, so nothing jumps except
 * the swap from source to typeset output.
 */
import {useEffect, useState} from 'react'
import {View} from 'react-native'

import {logger} from '#/logger'
import {atoms as a, useTheme} from '#/alf'
import {MathSourceBlock, MathSourceInline} from './MathSource'

type Katex = Pick<typeof import('katex'), 'renderToString'>

let katex: Katex | null = null
let katexPromise: Promise<Katex> | null = null

function loadKatex(): Promise<Katex> {
  katexPromise ??= Promise.all([
    import(/* webpackChunkName: "katex" */ 'katex'),
    // css-loader inlines the @font-face rules and rewrites their url()s to
    // the emitted font files, so the fonts ride along with this chunk.
    import(/* webpackChunkName: "katex" */ 'katex/dist/katex.min.css'),
  ]).then(([mod]) => {
    katex = mod.default ?? mod
    return katex
  })
  return katexPromise
}

/** The KaTeX API once loaded, `null` (source fallback) until then. */
function useKatex(): Katex | null {
  const [loaded, setLoaded] = useState(katex)
  useEffect(() => {
    if (loaded) return
    let cancelled = false
    loadKatex()
      .then(mod => {
        if (!cancelled) setLoaded(mod)
      })
      .catch(e => {
        logger.warn('math: failed to load KaTeX', {safeMessage: e})
      })
    return () => {
      cancelled = true
    }
  }, [loaded])
  return loaded
}

/**
 * Typesets `tex` to HTML. Input is untrusted post text, so `trust` stays off
 * (no \url, \href, \includegraphics and friends) and expansion is capped to
 * bound the work a hostile post can cause. Errors render inline in the
 * negative color instead of throwing.
 */
function typeset(
  api: Katex,
  tex: string,
  displayMode: boolean,
  errorColor: string,
): string {
  return api.renderToString(tex, {
    displayMode,
    throwOnError: false,
    errorColor,
    strict: 'ignore',
    trust: false,
    maxExpand: 1000,
    maxSize: 100,
    output: 'htmlAndMathml',
  })
}

export function MathInline({tex}: {tex: string; fontSize?: number}) {
  const t = useTheme()
  const api = useKatex()
  if (!api) return <MathSourceInline tex={tex} />
  return (
    <span
      className="mu-math"
      // KaTeX escapes its own output; see `typeset` for the trust settings.
      dangerouslySetInnerHTML={{
        __html: typeset(api, tex, false, t.palette.negative_500),
      }}
    />
  )
}

export function MathBlock({tex}: {tex: string; fontSize?: number}) {
  const t = useTheme()
  const api = useKatex()
  if (!api) return <MathSourceBlock tex={tex} />
  return (
    <View style={[a.w_full, a.my_xs]}>
      {/* Raw div so the block can scroll horizontally (see .mu-math-block in
          style.css); it sits outside any <Text>, hence the explicit color. */}
      <div
        className="mu-math-block"
        style={{color: t.atoms.text.color}}
        dangerouslySetInnerHTML={{
          __html: typeset(api, tex, true, t.palette.negative_500),
        }}
      />
    </View>
  )
}
