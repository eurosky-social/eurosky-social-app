# Local feature policy

`index.ts` is the checked-in feature configuration for all accounts. Shared
components retain their `ax.features.enabled()` / `getValue()` interface, but
there is no remote SDK, flag request, cached payload, account targeting or
experiment/exposure tracking. Startup and session creation never await flags.

Policy:

- Group chats, contact discovery, Live Now and profile links remain available
  subject to their normal service, age and regional restrictions.
- Experimental galleries, language detection, known-liker displays, follow
  sorting, Following v2, mandatory onboarding interests, moderation inbox and
  Atmosphere Explore stay off. Following v2's existing e2e override remains.
- Redesigned notifications use `EXPO_PUBLIC_ENABLE_NOTIFICATIONS_V2`, off by
  default. There is no internal-account or remote rollout override.
- Starter packs allow 150 people. Trending feed insertion uses positions 5,
  15 and 30; trending topic lists show 10. These match the previous public
  general-user configuration, without experiments or privileged overrides.
- Unknown boolean keys are off; unknown value keys use the caller's fallback.

The remote beta-program settings, debug dialog and server HTML fallback have
been removed. Existing AT Protocol beta preferences are not changed or deleted;
other clients may still use them, but they cannot alter this app's policy.

Tests: `pnpm test --runInBand src/analytics`.
