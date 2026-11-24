/**
 * Build-level switch for comments linked to a second of a video. Off unless
 * the build sets `EXPO_PUBLIC_ENABLE_MEDIA_TIME=true`.
 *
 * Posts that other builds or apps wrote keep working either way: with the
 * switch off, their time link renders as an ordinary link.
 */
export const MEDIA_TIME_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_MEDIA_TIME === 'true'
