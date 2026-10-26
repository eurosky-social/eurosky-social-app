import {useMemo} from 'react'
import {type TextStyle, type ViewStyle} from 'react-native'

import {useInterfaceStyle} from '#/state/preferences'
import {
  type PaletteColor,
  type PaletteColorName,
  useTheme,
} from '../ThemeContext'

export interface UsePaletteValue {
  colors: PaletteColor
  view: ViewStyle
  viewLight: ViewStyle
  btn: ViewStyle
  border: ViewStyle
  text: TextStyle
  textLight: TextStyle
  textInverted: TextStyle
  link: TextStyle
}

/**
 * @deprecated use `useTheme` from `#/alf`
 */
export function usePalette(color: PaletteColorName): UsePaletteValue {
  const theme = useTheme()
  const {borders} = useInterfaceStyle()
  return useMemo(() => {
    const themePalette = theme.palette[color]
    const palette =
      borders === 'hidden'
        ? {...themePalette, border: 'transparent'}
        : themePalette
    return {
      colors: palette,
      view: {
        backgroundColor: palette.background,
      },
      viewLight: {
        backgroundColor: palette.backgroundLight,
      },
      btn: {
        backgroundColor: palette.backgroundLight,
      },
      border: {
        borderColor: palette.border,
      },
      text: {
        color: palette.text,
      },
      textLight: {
        color: palette.textLight,
      },
      textInverted: {
        color: palette.textInverted,
      },
      link: {
        color: palette.link,
      },
    }
  }, [theme, color, borders])
}
