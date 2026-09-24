#!/usr/bin/env bash
set -o errexit
set -o nounset
set -o pipefail

cd "$(dirname "$0")/.."

if [[ $# != 1 || ! "$1" =~ ^[1-9][0-9]*$ ]]; then
  echo "Usage: pnpm ios:prepare-testflight <build-number>" >&2
  echo "Use a number higher than every build already uploaded for this version." >&2
  exit 1
fi

# Xcode archives do not use eas.json or its remote auto-increment counter.
export BSKY_IOS_BUILD_NUMBER="$1"
export EAS_BUILD_PLATFORM=ios
export EXPO_PUBLIC_ENV=testflight
export EXPO_PUBLIC_RELEASE_VERSION="$(node -p 'require("./package.json").version')"
export EXPO_PUBLIC_BUNDLE_IDENTIFIER="$(git rev-parse HEAD)"
export EXPO_PUBLIC_BUNDLE_DATE="$(date -u +"%y%m%d%H")"
# Pin Bluesky explicitly: react-native-dotenv ignores empty env overrides and
# would otherwise retain a Eurosky URL/DID from a stale .env file.
export EXPO_PUBLIC_APPVIEW_URL="https://api.bsky.app"
export EXPO_PUBLIC_APPVIEW_DID="did:web:api.bsky.app"
export EXPO_PUBLIC_BLUESKY_PROXY_DID="did:web:api.bsky.app"

# Regenerates ios/ (including Pods) with the right icon, version and modules.
pnpm prebuild --platform ios

# The GUI archive runs later, outside this shell. Preserve the bundle environment
# in Expo's Xcode env file so .env.local cannot switch it back to production or
# embed stale release metadata. Prebuild recreates this file on the next run.
{
  printf '\n# TestFlight environment from scripts/prepareIosTestflight.sh\n'
  for key in BSKY_IOS_BUILD_NUMBER EAS_BUILD_PLATFORM EXPO_PUBLIC_ENV \
    EXPO_PUBLIC_RELEASE_VERSION EXPO_PUBLIC_BUNDLE_IDENTIFIER \
    EXPO_PUBLIC_BUNDLE_DATE EXPO_PUBLIC_APPVIEW_URL EXPO_PUBLIC_APPVIEW_DID \
    EXPO_PUBLIC_BLUESKY_PROXY_DID; do
    printf 'export %s=%q\n' "$key" "${!key}"
  done
} >> ios/.xcode.env

actual_build="$(/usr/libexec/PlistBuddy -c 'Print CFBundleVersion' ios/mu/Info.plist)"
if [[ "$actual_build" != "$BSKY_IOS_BUILD_NUMBER" ]]; then
  echo "Expected build $BSKY_IOS_BUILD_NUMBER, but generated $actual_build. Do not archive." >&2
  exit 1
fi

echo "Prepared mu $EXPO_PUBLIC_RELEASE_VERSION ($actual_build) with the TestFlight icon."
echo "Open ios/mu.xcworkspace, select a device destination, then Product > Archive."
echo "Before uploading, verify the archive version/build; disable 'Manage version and build number'."
