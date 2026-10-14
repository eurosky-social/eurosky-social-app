/**
 * DID of the account whose starter packs the screen lists. When unset, the
 * screen shows `FALLBACK_STARTER_PACKS` instead.
 */
export const OSO_STARTER_PACKS_ACTOR: string | undefined =
  process.env.EXPO_PUBLIC_OSO_STARTER_PACKS_ACTOR || undefined
