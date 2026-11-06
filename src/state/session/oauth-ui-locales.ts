import {sanitizeAppLanguageSetting} from '#/locale/helpers'
import * as persisted from '#/state/persisted'

/**
 * The `ui_locales` shape the PDS accepts (`@atproto/oauth-types`). It rejects
 * the whole authorization request on anything else, so a bad value would break
 * sign-in rather than just the language.
 */
const UI_LOCALE = /^[a-z]{2,3}(-[A-Z]{2})?$/

/**
 * An app language as an OAuth `ui_locales` value: the language plus an
 * optional region, without a script subtag (`zh-Hans-CN` -> `zh-CN`).
 * Undefined if it still doesn't fit.
 */
export function toUiLocale(appLanguage: string): string | undefined {
  const [lang, ...rest] = appLanguage.split('-')
  const region = rest.at(-1)
  const tag = region && /^[A-Z]{2}$/.test(region) ? `${lang}-${region}` : lang
  return UI_LOCALE.test(tag) ? tag : undefined
}

/**
 * Asks the PDS to show its sign-in and sign-up pages in the app's language.
 * The PDS falls back to the browser's languages when it lacks this one.
 */
export function getOAuthUiLocales(): {ui_locales?: string} {
  const ui_locales = toUiLocale(
    sanitizeAppLanguageSetting(persisted.get('languagePrefs').appLanguage),
  )
  return ui_locales ? {ui_locales} : {}
}
