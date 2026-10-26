// @ts-check
/**
 * Generate the branded assets that live outside the React Native runtime.
 *
 * Inputs:
 *   - src/config/brand.json (default accent and neutral palette)
 *   - src/config/brand-logo.generated.json (generated from assets/brand/*.svg)
 *   - assets/app-icons/ios_icon_default_next.png (the full-bleed app-icon master)
 *
 * Outputs:
 *   - transparent QR fallback logo and development default avatar
 *   - App Clip icon
 *   - bskyembed mark and wordmark/lockup
 *   - bskyweb default social cards
 *
 * Usage:
 *   node scripts/gen-brand-assets.mjs
 *   node scripts/gen-brand-assets.mjs --check
 */
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {Resvg} from '@resvg/resvg-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BRAND = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/config/brand.json'), 'utf8'),
)
const LOGOS = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'src/config/brand-logo.generated.json'),
    'utf8',
  ),
)
const A = BRAND.colors.accents[BRAND.colors.defaultAccent]
const N = BRAND.colors.neutral
const CHECK = process.argv.includes('--check')

if (!A) {
  throw new Error(
    `brand.json#colors: defaultAccent "${BRAND.colors.defaultAccent}" is not in accents`,
  )
}

/** Resolve currentColor and theme tokens to concrete colours. */
function paint(xml, current) {
  return xml
    .replace(/theme:([A-Za-z0-9_]+)/g, (_match, key) => A[key] ?? current)
    .replace(/currentColor/g, current)
}

/** Return the contents of an SVG without its outer element. */
function inner(xml) {
  return xml.replace(/^<svg\b[^>]*>/i, '').replace(/<\/svg>\s*$/i, '')
}

/** Pick the first authored logo role, with the required mark as fallback. */
function logoFor(...roles) {
  for (const role of roles) {
    if (LOGOS[role]) return LOGOS[role]
  }
  return LOGOS.mark
}

/** Produce a static SVG suitable for an img element. */
function staticLogo(...roles) {
  const logo = logoFor(...roles)
  return Buffer.from(
    paint(logo.xml, A.primary_500).replace(
      /<svg\b/,
      '<svg data-generated-by="scripts/gen-brand-assets.mjs"',
    ) + '\n',
  )
}

/** Render SVG markup to a PNG. */
function renderPng(svg, fitTo) {
  const options = fitTo ? {fitTo} : undefined
  return Buffer.from(new Resvg(svg, options).render().asPng())
}

/** Embed a logo in a fixed-size canvas. */
function composeLogo({w, h, role, background, foreground, scale}) {
  const logo = logoFor(...role)
  const logoWidth = w * scale
  const logoHeight = logoWidth * logo.ratio
  const x = (w - logoWidth) / 2
  const y = (h - logoHeight) / 2
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    background +
    `<svg x="${x}" y="${y}" width="${logoWidth}" height="${logoHeight}" viewBox="${logo.viewBox}">` +
    paint(inner(logo.xml), foreground) +
    '</svg></svg>'
  )
}

const mark = logoFor('mark')
const qrLogo = renderPng(paint(mark.xml, A.primary_500), {
  mode: 'width',
  value: 500,
})

const avatar = renderPng(
  composeLogo({
    w: 512,
    h: 512,
    role: ['mark'],
    background: `<rect width="512" height="512" fill="${A.primary_50}"/>`,
    foreground: A.primary_500,
    scale: 0.64,
  }),
)

const socialCard = renderPng(
  composeLogo({
    w: 1200,
    h: 630,
    role: ['lockup', 'wordmark', 'mark'],
    background: `<rect width="1200" height="630" fill="${A.primary_500}"/>`,
    foreground: N.contrast_0,
    scale: 0.52,
  }),
)

const gradientSocialCard = renderPng(
  composeLogo({
    w: 1200,
    h: 630,
    role: ['lockup', 'wordmark', 'mark'],
    background:
      '<defs><linearGradient id="brand-gradient" x1="0" y1="0" x2="1" y2="1">' +
      `<stop offset="0" stop-color="${A.primary_700}"/>` +
      `<stop offset="1" stop-color="${A.primary_400}"/>` +
      '</linearGradient></defs>' +
      '<rect width="1200" height="630" fill="url(#brand-gradient)"/>',
    foreground: N.contrast_0,
    scale: 0.52,
  }),
)

const appIconMaster = fs.readFileSync(
  path.join(ROOT, 'assets/app-icons/ios_icon_default_next.png'),
)

const targets = new Map([
  ['assets/logo.png', qrLogo],
  ['assets/default-avatar.png', avatar],
  [
    'modules/BlueskyClip/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png',
    appIconMaster,
  ],
  ['bskyembed/assets/logo.svg', staticLogo('mark')],
  [
    'bskyembed/assets/logo_full_name.svg',
    staticLogo('lockup', 'wordmark', 'mark'),
  ],
  ['bskyweb/static/social-card-default.png', socialCard],
  ['bskyweb/static/social-card-default-gradient.png', gradientSocialCard],
])

const drift = []
for (const [relativePath, next] of targets) {
  const file = path.join(ROOT, relativePath)
  const previous = fs.existsSync(file) ? fs.readFileSync(file) : null
  if (previous?.equals(next)) {
    if (!CHECK) console.log(`unchanged  ${relativePath}`)
    continue
  }
  if (CHECK) {
    drift.push(relativePath)
  } else {
    fs.mkdirSync(path.dirname(file), {recursive: true})
    fs.writeFileSync(file, next)
    console.log(`updated    ${relativePath}`)
  }
}

if (CHECK && drift.length) {
  console.error(
    `\nbrand assets out of sync:\n  ${drift.join('\n  ')}\n\nRun: pnpm brand:gen-assets`,
  )
  process.exit(1)
}
if (CHECK) console.log('brand assets in sync')
