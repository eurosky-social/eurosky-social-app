/** @jest-environment jsdom */

import {themes} from '#/alf/themes'
import {syncDocumentTheme} from '#/alf/util/useColorModeTheme'
import {halloweenThemes} from './themes'

jest.mock('#/env', () => ({IS_WEB: true}))
jest.mock('#/features/halloween/context', () => ({useHalloween: jest.fn()}))
jest.mock('#/state/shell', () => ({useThemePrefs: jest.fn()}))

beforeEach(() => {
  document.head.innerHTML = '<meta name="theme-color" content="initial">'
  document.body.innerHTML = '<div id="root"></div>'
  document.documentElement.className = 'unrelated theme--light'
  localStorage.clear()
})

it.each(['light', 'dark', 'dim'] as const)(
  'syncs %s browser chrome and CSS surfaces, then restores the regular palette',
  name => {
    for (const resolved of [halloweenThemes[name], themes[name]]) {
      syncDocumentTheme(name, resolved)
      const background = resolved.atoms.bg.backgroundColor
      expect(
        document
          .querySelector('meta[name="theme-color"]')
          ?.getAttribute('content'),
      ).toBe(background)
      expect(document.documentElement.className.trim()).toBe(
        `unrelated theme--${name}`,
      )
      expect(localStorage.getItem('ALF_THEME')).toBe(name)
      for (const element of [
        document.documentElement,
        document.body,
        document.getElementById('root')!,
      ]) {
        expect(element.style.getPropertyValue('--background')).toBe(background)
        expect(element.style.getPropertyValue('--text')).toBe(
          resolved.atoms.text.color,
        )
        expect(element.style.getPropertyValue('--backgroundLight')).toBe(
          name === 'light'
            ? resolved.palette.contrast_25
            : name === 'dim'
              ? resolved.palette.contrast_100
              : resolved.palette.contrast_50,
        )
        expect(element.style.backgroundColor).not.toBe('')
      }
    }
  },
)
