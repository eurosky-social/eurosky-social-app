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
if (override.hosts?.[0] !== (process.env.OSO_HOST || 'oso.social')) {
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
  links: {...base.links, ...override.links},
  oauth: {...base.oauth, ...override.oauth},
  decorations: {...base.decorations, ...override.decorations},
}
fs.writeFileSync(config, JSON.stringify(merged, null, 2) + '\n')

const logos = path.join(root, 'assets/brand')
for (const name of ['mark', 'wordmark', 'lockup', 'hero', 'icon', 'og']) {
  fs.rmSync(path.join(logos, `${name}.svg`), {force: true})
}
fs.copyFileSync(path.join(brandDir, 'mark.svg'), path.join(logos, 'mark.svg'))
// The wordmark shown on hero surfaces such as the signed-out splash.
fs.copyFileSync(path.join(brandDir, 'hero.svg'), path.join(logos, 'hero.svg'))

const html = path.join(root, 'web/index.html')
fs.writeFileSync(
  html,
  fs
    .readFileSync(html, 'utf8')
    .replace(
      '</head>',
      '  <meta name="robots" content="noindex,nofollow">\n  </head>',
    ),
)
console.log('Prepared Oso brand in isolated build directory')
