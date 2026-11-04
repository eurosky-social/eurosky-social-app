import {Features, features} from './index'

it('keeps ordinary functionality available without privileged targeting', () => {
  expect(features.enabled(Features.GroupChatsDisable)).toBe(false)
  expect(features.enabled(Features.LiveNowBetaDisable)).toBe(false)
  expect(features.enabled(Features.ImportContactsOnboardingDisable)).toBe(false)
  expect(features.enabled(Features.ImportContactsSettingsDisable)).toBe(false)
  expect(features.enabled(Features.IsBskyTeam)).toBe(false)
  expect(features.enabled(Features.DebugFeedContext)).toBe(false)
})

it.each([
  Features.ComposerLanguageDetectionEnable,
  Features.PostGalleryEmbedEnable,
  Features.PostFeedKnownLikersEnable,
  Features.PostThreadKnownLikersEnable,
  Features.FollowSortEnable,
  Features.FollowingV2Enable,
  Features.OnboardingInterestsRequiredEnable,
  Features.ModerationInboxEnable,
  Features.AtmosphereScreenEnable,
])('keeps the experimental feature %s disabled', feature => {
  expect(features.enabled(feature)).toBe(false)
})

it('retains general-user configuration values', () => {
  expect(features.getValue(Features.StarterPacksConfig, {limit: 1})).toEqual({
    limit: 150,
  })
  expect(features.getValue(Features.TrendingDiscoverValues, {})).toEqual({
    topics: 5,
    accounts: 15,
    videos: 30,
  })
  expect(features.getValue(Features.TrendingExploreTopicsCountValue, 1)).toBe(
    10,
  )
})

it('does not treat configuration objects or numbers as enabled flags', () => {
  expect(features.enabled(Features.StarterPacksConfig)).toBe(false)
  expect(features.enabled(Features.TrendingExploreTopicsCountValue)).toBe(false)
})

it('fails closed for unknown and inherited keys, preserving value fallbacks', () => {
  for (const key of ['unknown:enable', 'aa-test', 'constructor', 'toString']) {
    expect(features.enabled(key as Features)).toBe(false)
    const fallback = {limit: 3}
    expect(features.getValue(key as Features, fallback)).toBe(fallback)
  }
})

it.each([undefined, 'false', 'true'])(
  'uses only the build-level notifications switch (%s)',
  value => {
    const previous = process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS_V2
    try {
      if (value === undefined)
        delete process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS_V2
      else process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS_V2 = value
      jest.isolateModules(() => {
        const local = require('./index') as typeof import('./index')
        expect(local.features.enabled(Features.NotificationsV2Enable)).toBe(
          value === 'true',
        )
      })
    } finally {
      if (previous === undefined)
        delete process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS_V2
      else process.env.EXPO_PUBLIC_ENABLE_NOTIFICATIONS_V2 = previous
    }
  },
)

it('loads synchronously without fetching or exposing lifecycle and targeting APIs', () => {
  const fetch = jest.spyOn(global, 'fetch')
  try {
    jest.isolateModules(() => {
      const local = require('./index') as typeof import('./index')
      for (const feature of Object.values(Features)) {
        local.features.enabled(feature)
        local.features.getValue(feature, null)
      }
      expect(local).not.toHaveProperty('init')
      expect(local).not.toHaveProperty('refresh')
      expect(local.features).not.toHaveProperty('setAttributes')
      expect(local.features).not.toHaveProperty('setFeatures')
    })
    expect(fetch).not.toHaveBeenCalled()
  } finally {
    fetch.mockRestore()
  }
})
