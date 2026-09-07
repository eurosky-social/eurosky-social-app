/**
 * Unrendered TeX, shown as source. Both platforms show this until their
 * typesetter has loaded (KaTeX on web, MathJax on native), and native keeps
 * it if typesetting fails outright. Styled like code so it reads as "markup",
 * with the delimiters kept so the intent is obvious.
 */
import {View} from 'react-native'

import {CODE_LINE_HEIGHT, MONO_FONT, useCodePanelColor} from '#/lib/code/theme'
import {atoms as a, useTheme} from '#/alf'
import {Text} from '#/components/Typography'

export function MathSourceInline({tex}: {tex: string}) {
  const t = useTheme()
  return (
    <Text
      style={[
        a.rounded_xs,
        {
          fontFamily: MONO_FONT,
          backgroundColor: t.atoms.bg_contrast_50.backgroundColor,
          paddingHorizontal: 3,
        },
      ]}>
      {`$${tex}$`}
    </Text>
  )
}

export function MathSourceBlock({tex}: {tex: string}) {
  const t = useTheme()
  const bg = useCodePanelColor()
  return (
    <View
      style={[a.rounded_sm, a.px_md, a.py_sm, a.my_xs, {backgroundColor: bg}]}>
      <Text
        style={[
          a.text_sm,
          t.atoms.text,
          {fontFamily: MONO_FONT, lineHeight: CODE_LINE_HEIGHT},
        ]}>
        {`$$${tex}$$`}
      </Text>
    </View>
  )
}
