import {hexToHsv, hsvToHex, normalizeHex} from './colors'

it.each([
  '#000000',
  '#FFFFFF',
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#123456',
  '#FF8A24',
  '#777777',
  '#00FFFF',
])('round-trips %s through HSV without changing color', hex => {
  expect(hsvToHex(hexToHsv(hex))).toBe(hex)
})

it('supports precise custom six-digit colors and rejects invalid CSS', () => {
  expect(normalizeHex('abc123')).toBe('#ABC123')
  expect(normalizeHex('#AbC123')).toBe('#ABC123')
  for (const value of ['red', '#fff', '#xyzxyz', '#12345678', 'url(x)', ''])
    expect(normalizeHex(value)).toBeNull()
})

it('handles hue wrap and preserves black/white at saturation extremes', () => {
  expect(hsvToHex({h: 360, s: 1, v: 1})).toBe('#FF0000')
  expect(hsvToHex({h: -60, s: 1, v: 1})).toBe('#FF00FF')
  expect(hsvToHex({h: 70, s: 0, v: 1})).toBe('#FFFFFF')
  expect(hsvToHex({h: 70, s: 1, v: 0})).toBe('#000000')
})
