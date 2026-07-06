import {type TextStyle} from 'react-native'

import {type NameGradient} from './nameGradients'

/**
 * Text style that paints a display name with a gradient. Native has no cheap
 * text-fill gradient (masked-view is not installed and would need a native
 * rebuild), so we fall back to a representative solid color. Web gets the real
 * gradient - see nameGradientStyle.web.ts.
 *
 * `outline` adds a dark edge around the letters. Native can't stroke text, so
 * it approximates with a tight dark shadow.
 */
export function nameGradientTextStyle(
  gradient: NameGradient,
  opts?: {outline?: boolean},
): TextStyle {
  if (opts?.outline) {
    return {
      color: gradient.solid,
      textShadowColor: 'rgba(20,20,30,0.9)',
      textShadowOffset: {width: 0, height: 0},
      textShadowRadius: 3,
    }
  }
  return {color: gradient.solid}
}
