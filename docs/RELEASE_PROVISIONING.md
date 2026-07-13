# Release provisioning (iOS + Android)

How to take the Eurosky app from source to the App Store (TestFlight) and Google
Play. The in-repo config has been switched to Eurosky's identity; the remaining
steps require external accounts and cannot be done from the repo alone.

## Identity (already wired in-repo)

| Thing | Value |
|-------|-------|
| App display name | `mu` (`app.config.js` `expo.name`; matches `brand.json`) |
| iOS bundle ID | `social.mu.app` |
| iOS extension bundle IDs | `social.mu.app.Share-with-Bluesky`, `social.mu.app.BlueskyNSE`, `social.mu.app.AppClip` |
| Android package | `social.mu.app` |
| App Group (iOS) | `group.social.mu.app` |
| Expo owner (org slug) | `eurosky` (`app.config.js` `expo.owner`) |
| EAS project | `@eurosky/mu-social` (slug `mu-social`, id `52e14cdd-ab10-4b16-a0f4-fc918a9fa323`) |
| Sentry org | `eurosky` (only used when `SENTRY_AUTH_TOKEN` is set) |

Placeholders that still need real values (search the repo for `REPLACE_WITH_`):
`eas.json` submit block (`ascAppId`, `appleTeamId`, ASC API key id/issuer).

## Prerequisites

- Apple Developer Program membership (have it) + admin access to App Store Connect.
- Google Play Console developer account (have it).
- An Expo account with the **`eurosky`** organization (exists).
- `eas-cli` locally: `pnpm dlx eas-cli@latest --version` or `npm i -g eas-cli`.

## 1. Expo / EAS project (DONE)

The project is created and linked: `@eurosky/mu-social`
(`extra.eas.projectId` in `app.config.js`, `expo.slug: 'mu-social'`,
`expo.owner: 'eurosky'`). Verify anytime with `eas project:info`. The
config `slug` must always equal the server project's slug (`mu-social`),
or EAS commands error with a slug-mismatch.

## 2. Apple (iOS)

1. In the Apple Developer portal, register **Identifiers**:
   - App ID `social.mu.app` — enable capabilities: App Groups, Push
     Notifications, Communication Notifications, Associated Domains (later),
     Increased Memory Limit, Extended Virtual Addressing.
   - App IDs for the three extensions: `social.mu.app.Share-with-Bluesky`,
     `social.mu.app.BlueskyNSE`, `social.mu.app.AppClip`.
   - App Group `group.social.mu.app`, and attach it to the main app +
     Share + NSE + Clip App IDs.
2. In **App Store Connect**, create a new app for `social.mu.app`. Copy its
   numeric **Apple ID** → `eas.json` `submit.production.ios.ascAppId`.
   (Also update the App Clip smart-banner meta in
   `src/screens/StarterPack/StarterPackLandingScreen.tsx` — the `app-id=` value
   should be this numeric id.)
3. Create an **App Store Connect API key** (Users and Access → Integrations →
   App Store Connect API, role: App Manager). Download the `.p8`. Fill
   `eas.json`: `ascApiKeyId`, `ascApiKeyIssuerId`, and place the file at
   `ascApiKeyPath` (`./credentials/asc-api-key.p8`, git-ignored). Set
   `appleTeamId` too.
4. Let EAS manage signing certs + provisioning profiles:
   `eas credentials -p ios` (or it will prompt on first `eas build`). Sign in
   with the Apple account when asked; EAS creates the distribution cert and
   profiles for the app + all extensions.

## 3. Google (Android)

1. In **Google Play Console**, create an app with package `social.mu.app`.
2. Signing key: let EAS generate/manage the upload keystore
   (`eas credentials -p android`), then enroll in Play App Signing.
3. Create a **service account** (Google Cloud → IAM) with Play Console access
   (Play Console → Users & permissions → invite the service-account email,
   grant release permissions). Download its JSON key to
   `./credentials/google-play-service-account.json` (git-ignored) — matches
   `serviceAccountKeyPath` in `eas.json`.
4. First upload to a track usually must be done manually (a first AAB via the
   Play Console UI) before `eas submit` can push to `internal`/`production`.

## 4. Firebase (Android push / FCM) — required for Android builds

The committed `google-services.json` is the upstream example
(`package_name: xyz.blueskyweb.app`) and will fail the Google Services Gradle
plugin against `social.mu.app`.

1. Create a Firebase project for Eurosky, add an Android app with package
   `social.mu.app`.
2. Download the real `google-services.json` and replace the file at repo root.
   Its `package_name` must be `social.mu.app`.
3. Upload the FCM/APNs keys to your push backend as needed (the app sends
   `appId: 'social.mu.app'` to the notification service —
   `src/lib/notifications/notifications.ts`; the backend must accept that topic).

## 5. CI (GitHub Actions)

- The iOS/Android build+submit workflows were un-gated to run under
  `eurosky-social/eurosky-social-app` (were pinned to `bluesky-social/social-app`).
- Add repo secret **`EXPO_TOKEN`** (Expo → access tokens, scoped to the org).
  Optional: `SENTRY_AUTH_TOKEN`.
- Trigger via Actions → "Build and Submit iOS" / "Build and Submit Android"
  (`workflow_dispatch`), profile `testflight` / `testflight-android` first, then
  `production`.
- Still gated to upstream (intentionally left off): the `bskyweb`/`embedr`/
  `ogcard`/`link` AWS/GHCR docker pushes, `sync-internal`, and the OTA
  `bundle-deploy-eas-update` / `nightly-build` (OTA needs a Eurosky-hosted update
  server — see "Deferred" below).

## 6. First build

```bash
# regenerate native projects from the new identity
pnpm prebuild                      # expo prebuild --clean
# local sanity: pnpm ios / pnpm android
# then cloud builds:
pnpm build-ios                     # eas build -p ios (bumps build number)
pnpm build-android                 # eas build -p android
# submit:
eas submit -p ios --profile production
eas submit -p android --profile production
```

After the first `pnpm prebuild`, confirm the generated iOS scheme/product is
named `mu` (the CI paths assume `mu.ipa` / `mu.app.dSYM.zip`). If Expo sanitizes
the name differently, update those paths in
`.github/workflows/build-submit-ios.yml`.

## Deferred (not needed to ship, but for parity)

- **Custom URL scheme**: still `bluesky://` (`app.config.js` `scheme`, and
  hardcoded in `src/Navigation.tsx`, `src/lib/hooks/useIntentHandler.ts`,
  `src/lib/parseLinkingUrl.ts`, tests). Changing it avoids collision with the
  real Bluesky app on-device but touches many files — separate pass.
- **Universal links / Associated Domains**: `applinks:bsky.app` etc. in
  `app.config.js` point to Bluesky-controlled domains whose AASA we can't edit.
  Point these at a Eurosky domain and host `/.well-known/apple-app-site-association`
  there before enabling.
- **OTA updates**: `updates.url` is `https://updates.bsky.app/manifest`
  (Bluesky's). Stand up a Eurosky EAS Update / self-hosted manifest before
  enabling `bundle-deploy-eas-update.yml`.
- **Internal identifiers left as-is (not user-visible, not blockers)**: the
  Android SharedPreferences file name `"xyz.blueskyweb.app"`
  (`modules/expo-background-notification-handler/.../NotificationPrefs.kt`,
  `modules/expo-bluesky-swiss-army/.../SharedPrefs.kt` — must stay in sync with
  each other), and the `expo-receive-android-intents` Java package namespace
  `xyz.blueskyweb.app.exporeceiveandroidintents`. Neither is the app's
  `applicationId`; renaming is cosmetic and risky.
- **App icons / display name polish**, `CFBundleSpokenName` ("Blue Sky"), the
  contacts-permission copy ("allow Bluesky to use my contacts"), and the many
  `Trans`-wrapped "Bluesky" strings — brand copy pass.
