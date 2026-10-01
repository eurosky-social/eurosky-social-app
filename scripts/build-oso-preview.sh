#!/usr/bin/env bash
# Build Oso without touching Mu's brand.json, generated files or web-build/.
# The output is web-build-oso/ (or OSO_OUTPUT_DIR). Nothing is deployed here.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
OUT="$ROOT/web-build-oso"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Always work in a fresh tree; notably, never copy local secrets or a stale
# web-build. CI installs deps in this tree. The prepare-only option is a fast
# local smoke test using existing dependencies, not a deployable build.
rsync -a --exclude='.git' --exclude='node_modules' --exclude='web-build*' \
  --exclude='.expo' --exclude='.env*' --exclude='artifacts' \
  --exclude='ios' --exclude='android' --exclude='*.tsbuildinfo' \
  "$ROOT/" "$TMP/"
cd "$TMP"
export BRAND_BUILD_ISOLATED=1
export EXPO_PUBLIC_OAUTH_BASE_URL=https://oso.mu.social
export EXPO_PUBLIC_OAUTH_ASSERTION_URL=https://oauth-staging.mu.social/client-assertion
export EXPO_PUBLIC_THEME_FONT_FAMILY=LeagueSpartan
export EXPO_PUBLIC_THEME_BODY_SCALE=1.1
export EXPO_PUBLIC_PARTNER_PREVIEW=1
export EXPO_PUBLIC_PLAUSIBLE_DOMAIN=oso.mu.social
# Neither production Mu analytics nor the shadow-read probe belongs in a demo.
export EXPO_PUBLIC_ENABLE_METRICS=false
export EXPO_PUBLIC_APPVIEW_SHADOW_PERCENTAGE=0
export EXPO_PUBLIC_ENABLE_SPORTS=false

if [[ "${1:-}" == '--prepare-only' ]]; then
  ln -s "$ROOT/node_modules" node_modules
else
  pnpm install --frozen-lockfile
fi
node scripts/prepare-oso-preview.mjs
node scripts/gen-logo.mjs
node scripts/gen-raster.mjs --compose
node scripts/gen-logo.mjs
node scripts/sync-brand-web.mjs
node scripts/gen-brand-assets.mjs
node scripts/gen-brand-favicons.mjs
node scripts/gen-logo.mjs --check
node scripts/sync-brand-web.mjs --check
node scripts/gen-brand-assets.mjs --check
node scripts/gen-brand-favicons.mjs --check
if [[ "${1:-}" == '--prepare-only' ]]; then
  echo 'Oso brand codegen passed (no build or deployment)'
  exit 0
fi

# Bunny build performs its own install and writes web-build/ inside this tree.
export ROBOTS_MODE=disallow-all
bash scripts/bunny_build.sh
# Expo's web/ copy is not reliable for arbitrary files; copy explicitly.
cp web/LeagueSpartan-VF.woff2 web-build/LeagueSpartan-VF.woff2
# Expo emits Mu's native store identifiers in the web manifest even for a
# web-only partner preview. Do not advertise the Mu apps as related to Oso.
node <<'NODE'
const fs = require('node:fs')
const file = 'web-build/manifest.json'
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
delete manifest.related_applications
delete manifest.prefer_related_applications
fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n')
NODE
node <<'NODE'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const metadata = require('./web-build/oauth-client-metadata.json')
const html = fs.readFileSync('web-build/index.html', 'utf8')
assert.equal(metadata.client_id, 'https://oso.mu.social/oauth-client-metadata.json')
assert.equal(metadata.client_name, 'oso')
assert.deepEqual(metadata.redirect_uris, ['https://oso.mu.social/'])
assert.match(html, /og:url" content="https:\/\/oso\.mu\.social"/)
assert.match(html, /name="robots" content="noindex,nofollow"/)
assert.match(html, /LeagueSpartan/)
assert.match(fs.readFileSync('web-build/robots.txt', 'utf8'), /Disallow: \/$/m)
assert.equal(fs.readFileSync('web-build/og-image.jpg').subarray(0, 2).toString('hex'), 'ffd8')
assert.ok(fs.statSync('web-build/LeagueSpartan-VF.woff2').size > 0)
const manifest = require('./web-build/manifest.json')
assert.equal(manifest.name, 'oso')
assert.equal(manifest.related_applications, undefined)
console.log('Verified Oso identity, OAuth metadata, noindex and OG JPEG')
NODE
mkdir -p "$OUT"
# Avoid stale files from a previous Oso build while never deleting Mu's output.
rsync -a --delete web-build/ "$OUT/"
echo "Oso preview bundle: $OUT (not deployed)"
