/** Local calendar window, shared by the theme, invitation, and future effects. */
export function getHalloweenDate(date: Date) {
  return {
    year: date.getFullYear(),
    isHalloween:
      date.getMonth() === 9 && date.getDate() >= 28 && date.getDate() <= 31,
  }
}

/** Recheck wall-clock changes each minute, but hit local midnight exactly. */
export function getNextDateCheckDelay(date: Date) {
  const midnight = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
  )
  return Math.max(1, Math.min(60_000, midnight.getTime() - date.getTime()))
}

export type HalloweenPreference = {
  enabled: boolean
  promptedYear?: number
}

/** Consent is remembered, but seasonal visuals stay within October 28-31. */
export function resolveHalloween(
  preference: HalloweenPreference,
  date: ReturnType<typeof getHalloweenDate>,
) {
  return {
    ...date,
    enabled: preference.enabled,
    isActive: date.isHalloween && preference.enabled,
    shouldPrompt:
      date.isHalloween &&
      !preference.enabled &&
      preference.promptedYear !== date.year,
  }
}
