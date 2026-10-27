import {useLayoutEffect} from 'react'
import {type ColorSchemeName, useColorScheme} from 'react-native'
import {type Theme, type ThemeName} from '@bsky.app/alf'

import {useThemePrefs} from '#/state/shell'
import {themes} from '#/alf/themes'
import {IS_WEB} from '#/env'
import {useHalloween} from '#/features/halloween/context'

export function useColorModeTheme(
  themesOverride?: Partial<typeof themes>,
): ThemeName {
  const theme = useThemeName()
  const resolvedTheme = themesOverride?.[theme] ?? themes[theme]

  useLayoutEffect(() => {
    syncDocumentTheme(theme, resolvedTheme)
  }, [theme, resolvedTheme])

  return theme
}

export function useThemeName(): ThemeName {
  const colorScheme = useColorScheme()
  const {colorMode, darkTheme} = useThemePrefs()
  const {isActive: halloweenActive} = useHalloween()

  return halloweenActive
    ? 'dark'
    : getThemeName(colorScheme, colorMode, darkTheme)
}

function getThemeName(
  colorScheme: ColorSchemeName | null | undefined,
  colorMode: 'system' | 'light' | 'dark',
  darkTheme?: ThemeName,
) {
  if (
    (colorMode === 'system' && colorScheme === 'light') ||
    colorMode === 'light'
  ) {
    return 'light'
  } else {
    return darkTheme ?? 'dim'
  }
}

/** Match page chrome and CSS-only surfaces to the resolved runtime palette. */
export function syncDocumentTheme(theme: ThemeName, resolvedTheme: Theme) {
  if (IS_WEB && typeof window !== 'undefined') {
    const html = window.document.documentElement
    const meta = window.document.querySelector('meta[name="theme-color"]')

    // remove any other color mode classes
    html.className = html.className.replace(/(theme)--\w+/g, '')
    html.classList.add(`theme--${theme}`)
    /* Runtime overrides also cover browser chrome, overscroll, and form CSS. */
    const background = resolvedTheme.atoms.bg.backgroundColor
    meta?.setAttribute('content', background)
    for (const element of [
      html,
      window.document.body,
      window.document.getElementById('root'),
    ]) {
      if (!element) continue
      element.style.backgroundColor = background
      element.style.setProperty('--background', background)
      element.style.setProperty('--text', resolvedTheme.atoms.text.color)
      element.style.setProperty(
        '--backgroundLight',
        theme === 'light'
          ? resolvedTheme.palette.contrast_25
          : theme === 'dim'
            ? resolvedTheme.palette.contrast_100
            : resolvedTheme.palette.contrast_50,
      )
    }
    window.localStorage.setItem('ALF_THEME', theme)
  }
}

export function getBackgroundColor(theme: ThemeName): string {
  return themes[theme].atoms.bg.backgroundColor
}
