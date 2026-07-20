import {useMemo} from 'react'
import {type Theme} from '@bsky.app/alf'

import {useInterfaceStyle} from '#/state/preferences'
import {useThemePrefs} from '#/state/shell'
import {buildThemes} from '#/alf/themes'
import {type AccentKey, ACCENTS, DEFAULT_ACCENT} from '#/config/brand-theme'

function withoutBorders(theme: Theme): Theme {
  const transparentBorder = {borderColor: 'transparent'}
  return {
    ...theme,
    atoms: {
      ...theme.atoms,
      border_contrast_low: transparentBorder,
      border_contrast_medium: transparentBorder,
    },
  }
}

function applyInterfaceStyle(
  themes: ReturnType<typeof buildThemes>,
  {borders}: {borders: 'standard' | 'hidden'},
) {
  if (borders === 'standard') {
    return themes
  }
  return {
    ...themes,
    light: withoutBorders(themes.light),
    dark: withoutBorders(themes.dark),
    dim: withoutBorders(themes.dim),
  }
}

/**
 * Eurosky: resolve appearance preferences into a ThemeProvider override.
 * Accent colors and interface-style modifiers are applied to the generated
 * themes, keeping those customizations out of individual UI components.
 */
export function useThemesOverride():
  | ReturnType<typeof buildThemes>
  | undefined {
  const {accentColor} = useThemePrefs()
  const {borders} = useInterfaceStyle()
  return useMemo(() => {
    const hasCustomAccent =
      !!accentColor && accentColor in ACCENTS && accentColor !== DEFAULT_ACCENT

    const hideBorders = borders === 'hidden'

    if (!hasCustomAccent && !hideBorders) {
      return undefined
    }

    const resolvedThemes = buildThemes(
      hasCustomAccent ? (accentColor as AccentKey) : DEFAULT_ACCENT,
    )
    return applyInterfaceStyle(resolvedThemes, {borders})
  }, [accentColor, borders])
}
