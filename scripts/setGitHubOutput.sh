#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

output=$(eas build:version:get -p all --json --non-interactive)
BSKY_IOS_BUILD_NUMBER=$(jq -r '.buildNumber // 1' <<< "$output")
BSKY_ANDROID_VERSION_CODE=$(jq -r '.versionCode // 1' <<< "$output")

{
  echo PACKAGE_VERSION="$(jq -r '.version' package.json)"
  echo BSKY_IOS_BUILD_NUMBER="$BSKY_IOS_BUILD_NUMBER"
  echo BSKY_ANDROID_VERSION_CODE="$BSKY_ANDROID_VERSION_CODE"
} > "$GITHUB_OUTPUT"
