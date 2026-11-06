import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import {fileURLToPath} from 'node:url'

import sharp from 'sharp'

import {normalizeExportName, readIconSource} from './lib.mts'
import {iconSvg, sourcePath} from './lucide.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const manifest = JSON.parse(
  await fs.readFile(path.join(ROOT, 'scripts/lucide-icons.json'), 'utf8'),
)

async function pixels(svg) {
  return sharp(Buffer.from(svg.replaceAll('currentColor', '#000')))
    .resize(96, 96)
    .ensureAlpha()
    .raw()
    .toBuffer()
}

function alphaDifference(a, b) {
  let difference = 0
  for (let i = 3; i < a.length; i += 4) difference += Math.abs(a[i] - b[i])
  return difference / ((255 * a.length) / 4)
}

test('every generated UI and compatibility icon has a reviewed Lucide mapping', async () => {
  const expected = new Set()
  for (const [name, entry] of Object.entries(manifest.icons)) {
    assert.equal(normalizeExportName(name), name)
    const lane = name.includes('_') ? 'ui' : 'brands'
    const relative = `${lane}/${name}.svg`
    expected.add(relative)
    await fs.access(sourcePath(entry, ROOT))
    const icon = await readIconSource(path.join(ROOT, 'assets/icons'), relative)
    assert.equal(icon.codegen, true, name)
    assert.doesNotMatch(icon.optimized, /\b(?:stroke|transform)=/, name)
  }
  for (const lane of ['ui', 'brands']) {
    for (const file of await fs.readdir(
      path.join(ROOT, 'assets/icons', lane),
    )) {
      if (
        !file.endsWith('.svg') ||
        ['AppleLogo.svg', 'AndroidLogo.svg'].includes(file)
      )
        continue
      assert.ok(
        expected.has(`${lane}/${file}`),
        `Unmapped icon: ${lane}/${file}`,
      )
    }
  }
})

test('outlining preserves every source icon, including rounded rectangles, arcs, and overlapping strokes', async () => {
  const unique = new Map(
    [...Object.values(manifest.icons), ...manifest.embedIcons].map(entry => [
      JSON.stringify([entry.icon, entry.variant, entry.source]),
      entry,
    ]),
  )
  for (const entry of unique.values()) {
    const plain = {...entry, mirror: false, whiteBacking: false}
    let original = await fs.readFile(sourcePath(plain, ROOT), 'utf8')
    if (plain.variant === 'bold')
      original = original.replaceAll('stroke-width="2"', 'stroke-width="3"')
    const converted = await iconSvg(plain, ROOT)
    const [before, after] = await Promise.all([
      pixels(original),
      pixels(converted),
    ])
    const difference = alphaDifference(before, after)
    assert.ok(
      difference < 0.01,
      `${entry.icon}/${entry.variant}: ${(difference * 100).toFixed(2)}% raster difference`,
    )
    assert.ok(
      after.some((value, i) => i % 4 === 3 && value > 0),
      `${entry.icon} is empty`,
    )
  }
})

test('selected navigation and interaction states remain visually distinct', async () => {
  for (const icon of [
    'house',
    'bell',
    'bookmark',
    'heart',
    'message-circle',
    'newspaper',
    'search',
    'settings',
    'circle-user-round',
    'hash',
    'list',
  ]) {
    const variant = ['hash', 'list'].includes(icon) ? 'bold' : 'filled'
    const [outline, selected] = await Promise.all([
      iconSvg({icon, variant: 'outline'}, ROOT).then(pixels),
      iconSvg({icon, variant}, ROOT).then(pixels),
    ])
    assert.ok(
      alphaDifference(outline, selected) > 0.01,
      `${icon} selected state must differ`,
    )
  }
})

test('Large variants scale geometry and mirrored quotes retain the expected orientation', async () => {
  const entry = {icon: 'quote', variant: 'filled'}
  const normal = await iconSvg(entry, ROOT)
  const large = await iconSvg(entry, ROOT, {size: 64})
  const mirrored = await iconSvg({...entry, mirror: true}, ROOT)
  assert.match(large, /viewBox="0 0 64 64"/)
  assert.doesNotMatch(large, /transform=/)
  assert.ok(alphaDifference(await pixels(normal), await pixels(large)) < 0.005)
  const flipped = await sharp(Buffer.from(normal))
    .flop()
    .resize(96, 96)
    .ensureAlpha()
    .raw()
    .toBuffer()
  assert.ok(alphaDifference(flipped, await pixels(mirrored)) < 0.005)
})

test('rejects unreviewed sources, path traversal, and unsupported weights', () => {
  for (const entry of [
    {icon: '../heart', variant: 'outline'},
    {icon: 'heart', variant: 'duotone'},
    {icon: 'heart', variant: 'outline', source: 'remote'},
    {icon: 'ufo', variant: 'filled', source: 'lab'},
  ])
    assert.throws(() => sourcePath(entry, ROOT))
})
