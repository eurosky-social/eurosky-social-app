import {useLingui} from '@lingui/react/macro'

import {type NewsInterest} from '#/features/newsFeed/state/prefs'
import {useThemeName} from '../dutch/queries'
import {SUB_LOCATIONS} from './interests'

/**
 * What an interest's tab is called: its places (e.g. “Belgium · Utrecht”), or
 * for one from everywhere, its topics, or else “Everywhere”.
 */
export function useInterestTitle(): (interest: NewsInterest) => string {
  const {t: l, i18n} = useLingui()
  const themeName = useThemeName()
  const subLocationNames = new Map(
    Object.values(SUB_LOCATIONS)
      .flat()
      .map(region => [region.id, region.label]),
  )

  return interest => {
    /* A country narrowed to its sub-locations is named by those instead. */
    const places = [
      ...interest.countries
        .filter(
          country =>
            !interest.subLocations.some(id =>
              SUB_LOCATIONS[country]?.some(region => region.id === id),
            ),
        )
        .map(country => countryName(country, i18n.locale)),
      ...interest.subLocations.map(id => subLocationNames.get(id) ?? id),
    ]
    if (places.length > 0) return places.join(' · ')
    const topics = interest.themes.map(themeName)
    return topics.length > 0 ? topics.join(' · ') : l`Everywhere`
  }
}

/** A country's name in the app's language, or its code where unavailable. */
export function countryName(code: string, locale: string): string {
  try {
    if (Intl.DisplayNames) {
      const name = new Intl.DisplayNames([locale], {type: 'region'}).of(
        code.toUpperCase(),
      )
      if (name) return name
    }
  } catch {}
  return code.toUpperCase()
}
