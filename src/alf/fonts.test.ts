import {applyFonts, MONOSPACE_FONT_FAMILY, type MutableTextStyle} from './fonts'

jest.mock('#/storage', () => ({device: {get: jest.fn(), set: jest.fn()}}))
it.each(['system', 'theme'] as const)(
  'preserves the explicit code family under %s typography',
  family => {
    for (const fontFamily of [MONOSPACE_FONT_FAMILY]) {
      const style: MutableTextStyle = {
        fontFamily,
        fontWeight: '700',
        letterSpacing: 0,
      }
      applyFonts(style, family)
      expect(style).toMatchObject({
        fontFamily,
        fontWeight: '700',
        letterSpacing: 0,
      })
    }
  },
)
it('continues applying the ordinary UI theme font to other text', () => {
  const style: MutableTextStyle = {fontWeight: '400'}
  applyFonts(style, 'theme')
  expect(style.fontFamily).toContain('Inter')
})
