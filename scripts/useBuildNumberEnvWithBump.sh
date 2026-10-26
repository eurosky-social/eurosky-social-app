#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

output=$(eas build:version:get -p all --json --non-interactive)
currentIosVersion=$(jq -r '.buildNumber // 0' <<< "$output")
currentAndroidVersion=$(jq -r '.versionCode // 0' <<< "$output")

# A new EAS project has no remote versions yet. Starting from zero lets the
# first platform build use the local default of 1, which EAS then persists as
# that platform's initial remote version.
BSKY_IOS_BUILD_NUMBER=$((currentIosVersion + 1))
BSKY_ANDROID_VERSION_CODE=$((currentAndroidVersion + 1))

bash -c "BSKY_IOS_BUILD_NUMBER=$BSKY_IOS_BUILD_NUMBER BSKY_ANDROID_VERSION_CODE=$BSKY_ANDROID_VERSION_CODE $*"

