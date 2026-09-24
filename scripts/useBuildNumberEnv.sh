#!/bin/bash
set -o errexit
set -o pipefail
set -o nounset

# Build numbers already present in the environment take precedence over the
# global EAS counters. Production OTA deploys rely on this to target the
# specific native build they are for, since the counters advance with every
# testflight build.
if [ -z "${BSKY_IOS_BUILD_NUMBER:-}" ] || [ -z "${BSKY_ANDROID_VERSION_CODE:-}" ]; then
  output=$(eas build:version:get -p all --json --non-interactive)
fi

if [ -z "${BSKY_IOS_BUILD_NUMBER:-}" ]; then
  BSKY_IOS_BUILD_NUMBER=$(jq -r '.buildNumber // 1' <<< "$output")
fi

if [ -z "${BSKY_ANDROID_VERSION_CODE:-}" ]; then
  BSKY_ANDROID_VERSION_CODE=$(jq -r '.versionCode // 1' <<< "$output")
fi

export BSKY_IOS_BUILD_NUMBER BSKY_ANDROID_VERSION_CODE
exec "$@"
