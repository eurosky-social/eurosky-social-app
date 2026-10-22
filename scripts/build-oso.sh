#!/usr/bin/env bash
# Build Oso's web bundle (web-build/). Called by scripts/web_build.sh for the
# oso and oso-dev environments, which load the Oso build settings first.
# src/config/brand.json on the oso branch already carries the Oso brand, so
# this is the normal Bunny build plus Oso's static pages and a few checks.
set -euo pipefail
cd "$(dirname "$0")/.."

bash scripts/bunny_build.sh
# Static pages (FAQ, ...) as plain HTML next to the app, so they load without it.
node scripts/build-oso-pages.mjs web-build
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
const brand = require('./src/config/brand.json')
const metadata = require('./web-build/oauth-client-metadata.json')
const html = fs.readFileSync('web-build/index.html', 'utf8')
const origin = process.env.EXPO_PUBLIC_OAUTH_BASE_URL
assert.equal(brand.name, 'oso', 'src/config/brand.json is not the Oso brand')
assert.equal(metadata.client_id, `${origin}/oauth-client-metadata.json`)
assert.equal(metadata.client_name, 'oso')
assert.deepEqual(metadata.redirect_uris, [`${origin}/`])
assert.ok(html.includes(`og:url" content="https://${brand.hosts[0]}"`))
assert.match(html, /name="robots" content="noindex,nofollow"/)
assert.match(fs.readFileSync('web-build/robots.txt', 'utf8'), /Disallow: \/$/m)
assert.equal(fs.readFileSync('web-build/og-image.jpg').subarray(0, 2).toString('hex'), 'ffd8')
const manifest = require('./web-build/manifest.json')
assert.equal(manifest.name, 'oso')
assert.equal(manifest.related_applications, undefined)
console.log('Verified Oso identity, OAuth metadata, noindex and OG JPEG')
NODE
