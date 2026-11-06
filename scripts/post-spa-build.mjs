import fs from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const brand = JSON.parse(
  await fs.readFile(path.join(root, 'src/config/brand.json'), 'utf8'),
)
const accent = brand.colors.accents[brand.colors.defaultAccent]
const icon = path.join(root, 'assets/app-icons/ios_icon_default_next.png')

/* Metro does not generate the install manifest that Expo's webpack export did. */
await Promise.all(
  [192, 512].map(size =>
    sharp(icon)
      .resize(size, size)
      .png()
      .toFile(path.join(dist, `pwa-${size}.png`)),
  ),
)
await fs.copyFile(
  path.join(root, 'bskyweb/static/apple-touch-icon.png'),
  path.join(dist, 'apple-touch-icon.png'),
)
await fs.writeFile(
  path.join(dist, 'manifest.json'),
  JSON.stringify(
    {
      name: brand.name,
      short_name: brand.name,
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: brand.colors.neutral.contrast_0,
      theme_color: accent.primary_500,
      icons: [192, 512].map(size => ({
        src: `/pwa-${size}.png`,
        sizes: `${size}x${size}`,
        type: 'image/png',
      })),
    },
    null,
    2,
  ) + '\n',
)

/* Keep Bunny, Cloudflare, OAuth metadata and partner previews on web-build/. */
const output = path.join(root, 'web-build')
await fs.rm(output, {recursive: true, force: true})
await fs.cp(dist, output, {recursive: true})
console.log('Prepared installable SPA in web-build/')
