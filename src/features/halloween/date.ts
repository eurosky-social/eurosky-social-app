/** Local October 28 through November 3, shared by independent theme and costume features. */
export function getHalloweenDate(date: Date) {
  return {
    year: date.getFullYear(),
    isHalloween:
      (date.getMonth() === 9 && date.getDate() >= 28) ||
      (date.getMonth() === 10 && date.getDate() <= 3),
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
  costumePromptedYear?: number
}

/** Theme consent never gates costumes; both invitations are acknowledged independently each year. */
export function resolveHalloween(
  preference: HalloweenPreference,
  date: ReturnType<typeof getHalloweenDate>,
) {
  return {
    ...date,
    enabled: preference.enabled,
    isActive: date.isHalloween && preference.enabled,
    shouldPrompt: date.isHalloween && preference.promptedYear !== date.year,
    shouldPromptCostume:
      date.isHalloween && preference.costumePromptedYear !== date.year,
  }
}
