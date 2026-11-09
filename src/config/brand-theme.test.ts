import {buildThemes} from '#/alf/themes'
import brand from '#/config/brand.json'
import {
  type AccentKey,
  ACCENTS,
  buildPalettes,
  DEFAULT_ACCENT,
} from '#/config/brand-theme'

const ACCENT_KEYS = Object.keys(ACCENTS) as AccentKey[]
/**
 * The palette-wide checks are about a brand that offers a choice of accents.
 * A single-accent brand (Oso) has no rainbow to order or families to balance.
 */
const itPalette = ACCENT_KEYS.length > 1 ? it : it.skip
const PRIMARY_STOPS = [
  25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950, 975,
] as const

const LIGHTNESS_TARGETS = [
  0.98, 0.95, 0.9, 0.84, 0.77, 0.7, 0.55, 0.5, 0.44, 0.38, 0.32, 0.26, 0.2,
] as const

function linearRgb(hex: string): number[] {
  return hex
    .slice(1)
    .match(/../g)!
    .map(channel => {
      const value = parseInt(channel, 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    })
}

function luminance(hex: string): number {
  const [r, g, b] = linearRgb(hex)
  return r * 0.2126 + g * 0.7152 + b * 0.0722
}

/** OKLab's L component is also OKLCH's perceptual lightness. */
function perceptualLightness(hex: string): number {
  const [r, g, b] = linearRgb(hex)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

itPalette('offers a full rainbow in spectrum order', () => {
  expect(ACCENT_KEYS).toEqual([
    'red',
    'orange',
    'yellow',
    'green',
    'teal',
    'cyan',
    'blue',
    'indigo',
    'purple',
    'pink',
  ])
  expect(DEFAULT_ACCENT).toBe('pink')
})

it.each(ACCENT_KEYS)('%s has a complete light-to-dark ALF ramp', key => {
  const ramp = ACCENTS[key]
  expect(Object.keys(ramp)).toEqual(
    PRIMARY_STOPS.map(stop => `primary_${stop}`),
  )
  let previous = Infinity
  for (const stop of PRIMARY_STOPS) {
    const color = ramp[`primary_${stop}`]
    expect(color).toMatch(/^#[0-9A-F]{6}$/)
    const current = luminance(color)
    expect(current).toBeLessThan(previous)
    previous = current
  }
})

itPalette.each(
  PRIMARY_STOPS.map((stop, index) => ({
    stop,
    lightness: LIGHTNESS_TARGETS[index],
  })),
)('balances primary_$stop across all accent families', ({stop, lightness}) => {
  for (const key of ACCENT_KEYS) {
    const actual = perceptualLightness(ACCENTS[key][`primary_${stop}`])
    // Allow for rounding sRGB channels to 8-bit hex values.
    expect(Math.abs(actual - lightness)).toBeLessThan(0.002)
  }
})

it.each(ACCENT_KEYS)(
  '%s works in light, dark, and dim without tinting neutrals',
  key => {
    const palettes = buildPalettes(key)
    expect(palettes.default).toMatchObject(brand.colors.neutral)
    expect(palettes.subdued).toMatchObject({
      ...brand.colors.neutral,
      ...brand.colors.neutralSubduedOverrides,
    })

    const themes = buildThemes(key)
    for (const mode of ['light', 'dark', 'dim'] as const) {
      const theme = themes[mode]
      expect(theme.palette.primary_500).toBe(ACCENTS[key].primary_500)
      expect(theme.palette.primary_25).toBe(
        mode === 'light' ? ACCENTS[key].primary_25 : ACCENTS[key].primary_975,
      )
      expect(theme.atoms.text_link.color).toBe(
        mode === 'light' ? ACCENTS[key].primary_500 : ACCENTS[key].primary_400,
      )
    }
  },
)

it.each(ACCENT_KEYS)(
  '%s keeps button fills and theme links at WCAG AA contrast',
  key => {
    const themes = buildThemes(key)
    expect(
      contrast(ACCENTS[key].primary_500, '#FFFFFF'),
    ).toBeGreaterThanOrEqual(4.5)
    for (const mode of ['light', 'dark', 'dim'] as const) {
      const theme = themes[mode]
      expect(
        contrast(theme.atoms.text_link.color, theme.atoms.bg.backgroundColor),
      ).toBeGreaterThanOrEqual(4.5)
    }
  },
)
