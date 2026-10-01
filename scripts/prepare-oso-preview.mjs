// Run ONLY in the disposable copy created by build-oso-preview.sh.
// The existing single-brand generators write into src/, assets/ and web/.
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

if (process.env.BRAND_BUILD_ISOLATED !== '1') {
  throw new Error('Refusing to overwrite Mu: use scripts/build-oso-preview.sh')
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const brandDir = path.join(root, 'brands/oso')
const config = path.join(root, 'src/config/brand.json')
const base = JSON.parse(fs.readFileSync(config, 'utf8'))
const override = JSON.parse(
  fs.readFileSync(path.join(brandDir, 'brand.override.json'), 'utf8'),
)
if (override.hosts?.[0] !== 'oso.mu.social') {
  throw new Error('Unexpected Oso preview host')
}

// Only the accent families are replaced wholesale. Merge complete neutral
// ramps and non-visual defaults from the shared app, not Mu's other accents.
const merged = {
  ...base,
  ...override,
  colors: {
    ...base.colors,
    ...override.colors,
    neutral: {...base.colors.neutral, ...override.colors.neutral},
    neutralSubduedOverrides: {
      ...base.colors.neutralSubduedOverrides,
      ...override.colors.neutralSubduedOverrides,
    },
    accents: override.colors.accents,
  },
  oauth: {...base.oauth, ...override.oauth},
  decorations: {...base.decorations, ...override.decorations},
}
fs.writeFileSync(config, JSON.stringify(merged, null, 2) + '\n')

const logos = path.join(root, 'assets/brand')
for (const name of ['mark', 'wordmark', 'lockup', 'hero', 'icon', 'og']) {
  fs.rmSync(path.join(logos, `${name}.svg`), {force: true})
}
fs.copyFileSync(path.join(brandDir, 'mark.svg'), path.join(logos, 'mark.svg'))

// The site hosts this font; keep it in the isolated Oso bundle only. The
// app's web theme typography selects LeagueSpartan via build-time env.
fs.copyFileSync(
  path.join(brandDir, 'LeagueSpartan-VF.woff2'),
  path.join(root, 'web/LeagueSpartan-VF.woff2'),
)
const html = path.join(root, 'web/index.html')
fs.writeFileSync(
  html,
  fs
    .readFileSync(html, 'utf8')
    .replace(
      '</head>',
      '  <meta name="robots" content="noindex,nofollow">\n' +
        '  <style>\n' +
        '    @font-face { font-family: LeagueSpartan; src: url(/LeagueSpartan-VF.woff2) format("woff2"); font-weight: 100 900; font-display: swap; }\n' +
        '    body { font-family: LeagueSpartan, system-ui, sans-serif; }\n' +
        '  </style>\n  </head>',
    ),
)
console.log('Prepared Oso brand in isolated build directory')
