# Release provisioning (iOS + Android)

How to take the Eurosky app from source to the App Store (TestFlight) and Google
Play. The in-repo config has been switched to Eurosky's identity; the remaining
steps require external accounts and cannot be done from the repo alone.

## Identity (already wired in-repo)

| Thing | Value |
|-------|-------|
| App display name | `mu` (`app.config.js` `expo.name`; matches `brand.json`) |
| iOS bundle ID | `social.mu.app` |
| iOS extension bundle IDs | `social.mu.app.Share-with-Bluesky`, `social.mu.app.BlueskyNSE` |
| Android package | `social.mu.app` |
| App Group (iOS) | `group.social.mu.app` |
| Expo owner (org slug) | `eurosky` (`app.config.js` `expo.owner`) |
| Apple team | Stichting Modal (`2472Y2UN4X`) |
| EAS project | `@eurosky/mu-social` (slug `mu-social`, id `52e14cdd-ab10-4b16-a0f4-fc918a9fa323`) |
| Sentry org | `eurosky` (only used when `SENTRY_AUTH_TOKEN` is set) |

Placeholders that still need real values (search the repo for `REPLACE_WITH_`):
`eas.json` submit block (`ascAppId` and ASC API key id/issuer).

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
     Notifications, Communication Notifications, Increased Memory Limit, and
     Extended Virtual Addressing.
   - App IDs for the two extensions: `social.mu.app.Share-with-Bluesky` and
     `social.mu.app.BlueskyNSE`.
   - App Group `group.social.mu.app`, and attach it to the main app + Share +
     NSE App IDs.
2. In **App Store Connect**, create a new app for `social.mu.app`. Copy its
   numeric **Apple ID** → `eas.json` `submit.production.ios.ascAppId`.
   (Also add the numeric ID to any regular App Store smart-banner metadata if
   that is restored.)
3. Create an **App Store Connect API key** (Users and Access → Integrations →
   App Store Connect API, role: App Manager). Download the `.p8`. Fill
   `eas.json`: `ascApiKeyId`, `ascApiKeyIssuerId`, and place the file at
   `ascApiKeyPath` (`./credentials/asc-api-key.p8`, git-ignored). The Stichting
   Modal Apple Team ID is already configured in `eas.json`.
4. Let EAS manage signing certs + provisioning profiles:
   `eas credentials -p ios` (or it will prompt on first `eas build`). Sign in
   with the Apple account when asked; EAS creates the distribution cert and
   profiles for the app + retained extensions.

## 3. Google (Android)

1. In **Google Play Console**, create an app with package `social.mu.app`.
2. Signing key: let EAS generate/manage the upload keystore
   (`eas credentials -p android`), then enroll in Play App Signing.
3. Create or reuse a **service account** (Google Cloud → IAM), enable the Google
   Play Android Developer API in its Cloud project, and grant it Play Console
   access (Users & permissions → invite the service-account email). For beta
   submission, scope access to Mu and grant app read access and permission to
   release to testing tracks; production release access is not needed.
   Securely obtain its JSON key and upload it to EAS with
   `pnpm dlx eas-cli@latest credentials -p android`, under Google Service Account
   → Play Store submissions. `submit.testflight-android` uses the EAS-managed
   key. The separate production profile still references the git-ignored
   `./credentials/google-play-service-account.json` file.
4. The first manual Play upload is **already complete**: Play Console showed
   version **1.127.0 (14)** available to internal testers on July 16, 2026.
   Subsequent uploads can use EAS Submit once its service-account key is set up.

### Cloud Android beta build

```bash
pnpm dlx eas-cli@latest build -p android --profile testflight-android \
  --freeze-credentials --non-interactive --no-wait
```

This reuses EAS's existing Android keystore and increments the remote Android
version code. It does **not** submit to Google Play. The profile builds both:

- An AAB as the main artifact, for EAS Submit or manual upload to Play Console's
  Internal testing track.
- A signed release APK under additional build artifacts, for direct installation
  on an Android device without a development server.

The profile pins pnpm to the repository version and sets
`EAS_BUILD_DISABLE_MAVEN_CACHE=1`: the September 3 cloud build failed because
Expo's Maven cache returned HTTP 504 while downloading AndroidX dependencies.
Android targets API 36. The inherited AppView URL and both DIDs explicitly
select Bluesky; existing device-level choices remain respected.

`.easignore` excludes generated `bskyweb/static/` bundles as well as local
native projects, environment files, and private submission/signing files.
These web bundles otherwise added hundreds of megabytes to the native upload.
Use up-to-date CI-generated translation catalogs before distributing a release.

Direct APKs use the EAS upload key; Play-installed apps may use a different
Play App Signing key. Switching between those installs may require uninstalling
first, so use Play's internal track for ongoing tester updates.

Verified cloud build on **2026-09-18**: **1.132.0 (17)**, package
`social.mu.app`, [EAS build aedee725](https://expo.dev/accounts/eurosky/projects/mu-social/builds/aedee725-3fd6-4c7d-a874-9429e35de0b7).
Both AAB and APK built successfully; the downloaded APK's release signature,
package, version code, and target API 36 were verified. Local copies are in
`artifacts/android/mu-1.132.0-17.{apk,aab}` (git-ignored). AppView configuration
tests and Android type-checking passed. This was a working-tree build including
uncommitted changes. Build 17 was subsequently uploaded manually to Play; its
open-testing release was blocked by undeclared broad photo/video permissions.
Version code 16 was consumed by an interrupted upload, not a completed cloud
build.

### Android photo/video permissions

Build 17 included `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, and other read
permissions contributed by Expo Media Library. The replacement implementation
uses the system photo picker without library authorization, scoped saves on
Android 11+, and legacy write-only saves on older Android versions. iOS/web
behavior and the Bluesky AppView default are preserved. See
[`src/lib/media/photo-library/README.md`](../src/lib/media/photo-library/README.md)
for the API rationale and device smoke-test checklist.

Replacement cloud build: **1.133.0 (18)**,
[EAS build e13525a6](https://expo.dev/accounts/eurosky/projects/mu-social/builds/e13525a6-f84c-4c34-9418-58ea5c512faa),
built and verified on **2026-09-22**. Both packaged APK/AAB manifests omit
`READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`, `READ_MEDIA_AUDIO`,
`READ_MEDIA_VISUAL_USER_SELECTED`, `READ_EXTERNAL_STORAGE`, and
`ACCESS_MEDIA_LOCATION`. The package/version, target API 36, APK/AAB signatures,
and Bluesky AppView settings in the cloud build logs were verified. Local
artifacts and the verification record are under
`artifacts/android/mu-1.133.0-18.*` (git-ignored). This was a working-tree build
including uncommitted changes. The wider media/invite regression set passed
92 tests; all three platform typechecks, lint, and scoped formatting passed.
Nothing was submitted to Google Play by the build or verification process.

Library-provided declarations are explicitly blocked in `app.config.js`; future
changes to these permissions require a native rebuild and another manifest check.

Replace build 17 in the open-testing draft with the verified replacement build,
and update internal testing as well. Do not claim a broad-access use case just
to bypass the declaration form. Device smoke-testing remains required; unit
mocks cannot validate MediaStore behavior on actual Android devices.

### Submit an existing Android build to internal testing

```bash
pnpm dlx eas-cli@latest submit -p android --profile testflight-android \
  --id BUILD_ID --non-interactive
```

Replace `BUILD_ID` with the verified EAS build's ID. This submits its existing
AAB without rebuilding. The submit profile explicitly selects
`social.mu.app`, the `internal` track, and release status `completed`, making a
successful rollout available to existing internal testers, not to the public.
It uses the Google service-account key stored in EAS, not the Android keystore.

The September 18 submission attempt stopped before creating a submission:
no Play submission key was assigned to the app, and the `eurosky` Expo account
had **zero** stored Google service-account keys. Nothing was uploaded to Play.
Provision the key above, then rerun this command. Public/open testing remains a
separate Play Console rollout after its store and policy requirements are met.

## 4. Firebase (Android push / FCM)

Firebase can be deferred while push is intentionally unsupported. The app
config omits `googleServicesFile` when `google-services.json` is absent, so an
Android build can still compile, but remote Android push will not work.

1. Create a Firebase project for Eurosky, add an Android app with package
   `social.mu.app`.
2. Download the real `google-services.json` to the repo root. Its
   `package_name` must be `social.mu.app`; do not use the upstream
   `google-services.json.example` unchanged.
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

## 6. Repeatable local Xcode TestFlight builds

For the next upload, keep `package.json` at `1.132.0` and use build **3** (provided
no build 3 or higher has since been uploaded to App Store Connect):

```bash
pnpm ios:prepare-testflight 3
open ios/mu.xcworkspace
```

**This regenerates `ios/` with `prebuild --clean` and installs Pods.** Preserve any
manual native edits first; permanent changes belong in modules/config plugins.
Use CI-generated, up-to-date translation catalogs when preparing a release.

In Xcode, choose the `mu` scheme and a device destination, then **Product →
Archive**. In Organizer verify **1.132.0 (3)** before distributing to App Store
Connect. Disable **Manage version and build number** when exporting/uploading if
you want to preserve this exact number. Check the processed build's icon and
number in TestFlight before assigning it to testers.

Why the previous build reset/changed icon:

- A raw Xcode archive does **not** read `eas.json` or advance EAS's remote build
  counter. `app.config.js` falls back to build `1` without
  `BSKY_IOS_BUILD_NUMBER`; prebuild overwrites manual Xcode version edits.
- The white TestFlight icon requires both `EAS_BUILD_PLATFORM=ios` and
  `EXPO_PUBLIC_ENV=testflight` during prebuild. Without the platform variable,
  config takes the web PNG fallback; a production environment selects the pink
  production icon. Uploading to TestFlight does not select the TestFlight icon.
- The helper sets both variables and the explicit build number, then preserves
  the environment in `ios/.xcode.env` for later GUI archiving. It also refreshes
  release/commit metadata and pins the AppView URL/DID to Bluesky. Avoid conflicting exports in `ios/.xcode.env.local`.

For subsequent local uploads, pass **4**, **5**, etc., based on App Store Connect,
not just the local archive list. Do not bump `package.json` just to change the
number in parentheses.

### EAS alternative

Use one numbering workflow consistently. Before returning to EAS after manual
Xcode uploads, inspect its counter and, **only if behind**, set it to the highest
already-used build number (e.g. 2 before the next build 3):

```bash
pnpm dlx eas-cli@latest build:version:get -p ios -e testflight
pnpm dlx eas-cli@latest build:version:set -p ios -e testflight
pnpm dlx eas-cli@latest build -p ios --profile testflight
```

EAS's `autoIncrement` assigns the next number. Select `testflight`, not the
implicit `production` profile, to retain the TestFlight icon. Submission still
requires replacing the `eas.json` ASC placeholders above. Do not use EAS counter
values to infer the number of a manually archived Xcode build.

### AppView default

`src/config/brand.json` defaults to Bluesky: public reads use
`https://public.api.bsky.app`, direct reads use `https://api.bsky.app`, and signed-in
reads use `did:web:api.bsky.app#bsky_appview` through the account's PDS. Native
release profiles explicitly pin the URL/DID to Bluesky (using `api.bsky.app` for
public reads too), so stale environment files cannot silently select Eurosky.
Staging/dev no longer force Eurosky. Existing explicit device choices are preserved. To change one, select **Bluesky**
in **Settings → Network services → Content service**, save, and restart.
Production web's separate Eurosky shadow-traffic experiment is unchanged; its
responses are not used as the primary AppView.

## 7. First build

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
- **App Clip**: removed from the v1 native targets and smart-banner metadata.
  Restore it only after Mu owns the required web association and provisioning.
- **Universal links / Associated Domains**: removed for v1 because Bluesky's
  AASA and Android asset-links files do not authorize Mu. Point these at a
  Mu-controlled domain and host the association files before restoring them.
- **OTA updates**: disabled, with no update URL or signing certificate embedded.
  Stand up a Mu-controlled update service and signing key before restoring the
  config or enabling `bundle-deploy-eas-update.yml`.
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
