/**
 * Build-level kill switch for the redesigned notifications screen, including
 * internal builds and GrowthBook rollouts. Opt in explicitly once it is ready.
 */
export const NOTIFICATIONS_V2_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS_V2 === 'true'
