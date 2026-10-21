#!/usr/bin/env bash
# Run the Oso web app locally with the Expo dev server.
#
# Like build-oso-preview.sh, this applies the Oso brand in a separate copy of
# the repo, so Mu's brand.json and generated files in this checkout stay
# untouched. The copy is a snapshot: re-run this script to pick up changes made
# in the checkout (including brands/oso/). Sign-in uses the normal local dev
# OAuth setup, not Oso's production client.
#
#   bash scripts/dev-oso-preview.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
# Outside the repo so typecheck, lint and Jest never see a second source tree.
DEV="${OSO_DEV_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/eurosky-oso-dev}"

if [[ ! -d "$ROOT/node_modules" ]]; then
  echo 'Run pnpm install in the checkout first' >&2
  exit 1
fi

mkdir -p "$DEV"
rsync -a --delete --exclude='.git' --exclude='node_modules' \
  --exclude='web-build*' --exclude='.expo' --exclude='.env*' \
  --exclude='artifacts' --exclude='.pnpm-store' --exclude='ios' \
  --exclude='android' --exclude='*.tsbuildinfo' \
  "$ROOT/" "$DEV/"
ln -sfn "$ROOT/node_modules" "$DEV/node_modules"
cd "$DEV"

export BRAND_BUILD_ISOLATED=1
node scripts/prepare-oso-preview.mjs
node scripts/gen-logo.mjs
node scripts/sync-brand-web.mjs

# The visual and behavioural flags from build-oso-preview.sh.
export EXPO_PUBLIC_THEME_BODY_SCALE=1.1
export EXPO_PUBLIC_PARTNER_PREVIEW=1
export EXPO_PUBLIC_ENABLE_NEWS_V2="${EXPO_PUBLIC_ENABLE_NEWS_V2:-true}"
export EXPO_PUBLIC_ENABLE_METRICS=false
export EXPO_PUBLIC_ENABLE_SPORTS=false

echo "Oso dev tree: $DEV"
exec pnpm web
