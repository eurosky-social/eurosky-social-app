import {NOTIFICATIONS_V2_ENABLED} from '#/screens/Notifications/config'
import {Features} from '#/analytics/features/types'

export {Features} from '#/analytics/features/types'

/**
 * Build-local feature policy. No remote configuration, account targeting,
 * experiments, persistent cache or evaluation telemetry.
 *
 * Keep ordinary features available and unreleased features disabled. Value
 * settings retain the public rollout's general-user configuration; privileged
 * accounts and beta opt-ins do not override this policy.
 */
const VALUES: Readonly<Record<Features, unknown>> = Object.freeze({
  [Features.IsBskyTeam]: false,
  [Features.DebugFeedContext]: false,
  [Features.ImportContactsOnboardingDisable]: false,
  [Features.ImportContactsSettingsDisable]: false,
  [Features.LiveNowBetaDisable]: false,
  [Features.GroupChatsDisable]: false,
  [Features.ComposerLanguageDetectionEnable]: false,
  [Features.PostGalleryEmbedEnable]: false,
  [Features.PostFeedKnownLikersEnable]: false,
  [Features.PostThreadKnownLikersEnable]: false,
  [Features.FollowSortEnable]: false,
  [Features.FollowingV2Enable]: false,
  [Features.OnboardingInterestsRequiredEnable]: false,
  [Features.ModerationInboxEnable]: false,
  [Features.AtmosphereScreenEnable]: false,
  [Features.NotificationsV2Enable]: NOTIFICATIONS_V2_ENABLED,
  [Features.StarterPacksConfig]: Object.freeze({limit: 150}),
  [Features.TrendingDiscoverValues]: Object.freeze({
    topics: 5,
    accounts: 15,
    videos: 30,
  }),
  [Features.TrendingExploreTopicsCountValue]: 10,
})

/** Unknown flags fail closed, including any stale upstream keys. */
function enabled(feature: Features): boolean {
  return Object.hasOwn(VALUES, feature) && VALUES[feature] === true
}

/** Return a checked-in setting, or the caller's fallback for an unknown key. */
function getValue<T>(feature: Features, defaultValue: T): T {
  return Object.hasOwn(VALUES, feature) ? (VALUES[feature] as T) : defaultValue
}

export const features = Object.freeze({...Features, enabled, getValue})
