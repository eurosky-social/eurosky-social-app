import {defaultTheme, withAlfTheme} from '#/lib/themes'
import {buildThemes, themes} from '#/alf/themes'
import {DEFAULT_ACCENT} from '#/config/brand-theme'
import {HALLOWEEN_ACCENT, halloweenThemes} from './themes'

it.each(['light', 'dark', 'dim'] as const)(
  'reuses the normal %s theme with the Halloween accent',
  name => {
    expect(halloweenThemes[name]).toEqual(buildThemes(HALLOWEEN_ACCENT)[name])
    expect(halloweenThemes[name].atoms.bg).toEqual(themes[name].atoms.bg)
    expect(halloweenThemes[name].atoms.text).toEqual(themes[name].atoms.text)
  },
)

it.each(['light', 'dark', 'dim'] as const)(
  'bridges the %s palette to legacy feed and composer styles',
  name => {
    const current = halloweenThemes[name]
    const inverse = halloweenThemes[name === 'light' ? 'dark' : 'light']
    const legacy = withAlfTheme(defaultTheme, current, inverse)
    expect(legacy.palette.default.background).toBe(
      current.atoms.bg.backgroundColor,
    )
    expect(legacy.palette.default.text).toBe(current.atoms.text.color)
    expect(legacy.palette.default.link).toBe(current.atoms.text_link.color)
    expect(legacy.palette.inverted.background).toBe(
      inverse.atoms.bg.backgroundColor,
    )
    expect(legacy.palette.primary.background).toBe(current.palette.primary_500)
    expect(legacy.palette.error).toBe(defaultTheme.palette.error)
    expect(legacy.typography).toBe(defaultTheme.typography)
  },
)

it('uses the true dark background, not the dim one', () => {
  expect(halloweenThemes.dark.atoms.bg).toEqual(themes.dark.atoms.bg)
  expect(halloweenThemes.dark.atoms.bg).not.toEqual(themes.dim.atoms.bg)
})

it('does not mutate normal themes', () => {
  expect(themes.light.palette).toEqual(
    buildThemes(DEFAULT_ACCENT).light.palette,
  )
})

// Single-accent brands such as Oso keep their own accent for Halloween.
;(HALLOWEEN_ACCENT === DEFAULT_ACCENT ? it.skip : it)(
  'switches to a different accent than the normal themes',
  () => {
    expect(themes.light.palette.primary_500).not.toBe(
      halloweenThemes.light.palette.primary_500,
    )
  },
)
