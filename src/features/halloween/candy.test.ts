import {contrastRatio} from '#/alf/util/colorGeneration'
import {CANDY_COLORS, getCandyColor} from './candy'

const uri = 'at://did:plc:alice/app.bsky.feed.post/3kabc'

it('keeps a fixed color for the same post across calls and reloads', () => {
  expect(getCandyColor(uri)).toBe('#A3E635')
  expect(getCandyColor(uri)).toBe(getCandyColor(String(uri)))
})

it('includes the author identity, not just the rkey', () => {
  expect(getCandyColor(uri)).not.toBe(
    getCandyColor('at://did:plc:bob/app.bsky.feed.post/3kabc'),
  )
})

it('varies the colors across posts without using randomness', () => {
  const random = jest.spyOn(Math, 'random').mockImplementation(() => {
    throw new Error('Candy colors must not use randomness')
  })
  try {
    const colors = new Set(
      Array.from({length: 200}, (_, index) => getCandyColor(`${uri}${index}`)),
    )
    expect(colors.size).toBe(CANDY_COLORS.length)
  } finally {
    random.mockRestore()
  }
})

it.each(CANDY_COLORS)('keeps %s readable against true black', color => {
  expect(contrastRatio(color, '#000000')).toBeGreaterThanOrEqual(4.5)
})

it('always returns a palette color, including for an empty URI', () => {
  expect(CANDY_COLORS).toContain(getCandyColor(''))
})
