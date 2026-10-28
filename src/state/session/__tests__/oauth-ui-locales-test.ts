import {describe, expect, it} from '@jest/globals'

import {AppLanguage} from '#/locale/languages'
import {toUiLocale} from '../oauth-ui-locales'

/** The check `@atproto/oauth-types` applies to `ui_locales`. */
const PDS_UI_LOCALES = /^[a-z]{2,3}(-[A-Z]{2})?( [a-z]{2,3}(-[A-Z]{2})?)*$/

describe('toUiLocale', () => {
  it('keeps plain languages and language-region tags', () => {
    expect(toUiLocale('nl')).toBe('nl')
    expect(toUiLocale('ast')).toBe('ast')
    expect(toUiLocale('pt-BR')).toBe('pt-BR')
  })

  it('drops the script subtag', () => {
    expect(toUiLocale('zh-Hans-CN')).toBe('zh-CN')
    expect(toUiLocale('zh-Hant-TW')).toBe('zh-TW')
  })

  it('gives up on tags the PDS would reject', () => {
    expect(toUiLocale('')).toBeUndefined()
    expect(toUiLocale('EN')).toBeUndefined()
  })

  it('turns every app language into a value the PDS accepts', () => {
    for (const language of Object.values(AppLanguage)) {
      expect(toUiLocale(language)).toMatch(PDS_UI_LOCALES)
    }
  })
})
