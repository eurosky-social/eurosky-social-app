/**
 * Build-level switch for comments linked to a second of a video. Off unless
 * the build sets `EXPO_PUBLIC_ENABLE_MEDIA_TIME=true`.
 *
 * Posts that other builds or apps wrote keep working either way: with the
 * switch off, their time link renders as an ordinary link.
 */
export const MEDIA_TIME_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_MEDIA_TIME === 'true'

/**
 * Where moments come from: an AppView that answers
 * `network.eurosky.feed.getMoments` (Eurosky's does). It counts all of a
 * video's linked replies; without it, or when it fails, the app groups the
 * replies its thread loaded. Asked without signing in: the answer is public
 * and the same for everyone.
 */
export const MOMENTS_SERVICE_URL =
  process.env.EXPO_PUBLIC_MEDIA_TIME_MOMENTS_URL ||
  'https://api.eurosky.network'
