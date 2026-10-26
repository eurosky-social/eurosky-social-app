import {type TextStyle} from 'react-native'

import {type NameGradient} from './nameGradients'

/**
 * Paints the name with a real gradient via background-clip: text. The text
 * itself is transparent and reveals the gradient behind it. Placed last in a
 * style array so `color: transparent` overrides the theme text color.
 *
 * `outline` draws a dark stroke around the letters (the bubbly-logo look).
 * Stroke width is in `em` so it scales with the name's font size, and
 * `paint-order: stroke` puts the stroke behind the fill so the gradient stays
 * crisp. The outline doubles as a contrast guarantee - a gradient name reads
 * on any background once it has a hard edge.
 */
export function nameGradientTextStyle(
  gradient: NameGradient,
  opts?: {outline?: boolean},
): TextStyle {
  const stops = gradient.colors.join(', ')
  const base: Record<string, unknown> = {
    backgroundImage: `linear-gradient(90deg, ${stops})`,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
  }
  if (opts?.outline) {
    return {
      ...base,
      WebkitTextStroke: '0.06em rgba(20,20,30,0.92)',
      paintOrder: 'stroke',
    } as TextStyle
  }
  // A hairline shadow keeps a gradient name legible against a matching-tone
  // background without muddying the color.
  return {...base, textShadow: '0 0 1px rgba(0,0,0,0.06)'} as TextStyle
}
