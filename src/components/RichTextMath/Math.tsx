/**
 * Native math renderers. TeX is typeset to SVG by MathJax
 * (`#/lib/math/mathjax`) and drawn with react-native-svg: inline math is a
 * fixed-size `<View>` placed inside the surrounding `<Text>` like any other
 * inline attachment; display math is a horizontally scrollable row so wide
 * equations never overflow the post. The TeX source shows until the
 * typesetter has loaded and run.
 */
import {useEffect, useState} from 'react'
import {ScrollView, View} from 'react-native'
import {SvgXml} from 'react-native-svg'

import {
  exToPx,
  getCachedTypeset,
  typeset,
  type TypesetResult,
} from '#/lib/math/mathjax'
import {logger} from '#/logger'
import {atoms as a, useTheme} from '#/alf'
import {MathSourceBlock, MathSourceInline} from './MathSource'

function useTypeset(tex: string, display: boolean): TypesetResult | null {
  const [result, setResult] = useState(() => getCachedTypeset(tex, display))
  useEffect(() => {
    const cached = getCachedTypeset(tex, display)
    if (cached) {
      setResult(cached)
      return
    }
    let cancelled = false
    typeset(tex, display)
      .then(next => {
        if (!cancelled) setResult(next)
      })
      .catch(e => {
        logger.warn('math: typesetting failed', {safeMessage: e})
      })
    return () => {
      cancelled = true
    }
  }, [tex, display])
  return result
}

export function MathInline({
  tex,
  fontSize = a.text_sm.fontSize,
}: {
  tex: string
  /** Font size of the surrounding text, so the math matches its scale. */
  fontSize?: number
}) {
  const t = useTheme()
  const result = useTypeset(tex, false)
  if (!result) return <MathSourceInline tex={tex} />
  const width = exToPx(result.widthEx, fontSize)
  const height = exToPx(result.heightEx, fontSize)
  // The box's bottom sits on the baseline by default; push it down by the
  // amount MathJax says hangs below (its vertical-align is negative then).
  const drop = -exToPx(result.verticalAlignEx, fontSize)
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={tex}
      accessibilityHint=""
      style={{width, height, transform: [{translateY: drop}]}}>
      <SvgXml
        xml={result.svg}
        width={width}
        height={height}
        color={t.atoms.text.color}
      />
    </View>
  )
}

export function MathBlock({
  tex,
  fontSize = a.text_md.fontSize,
}: {
  tex: string
  fontSize?: number
}) {
  const t = useTheme()
  const result = useTypeset(tex, true)
  if (!result) return <MathSourceBlock tex={tex} />
  const width = exToPx(result.widthEx, fontSize)
  const height = exToPx(result.heightEx, fontSize)
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="image"
      accessibilityLabel={tex}
      accessibilityHint=""
      style={[a.my_xs]}
      contentContainerStyle={[a.flex_grow, a.justify_center, a.py_xs]}>
      <SvgXml
        xml={result.svg}
        width={width}
        height={height}
        color={t.atoms.text.color}
      />
    </ScrollView>
  )
}
