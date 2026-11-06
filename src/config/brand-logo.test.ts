import {getLogo, substituteLogoColors} from './brand-logo'
import generated from './brand-logo.generated.json'

it('uses the mu news lockup for news wordmarks, without changing social', () => {
  expect(getLogo('wordmark', 'news')).toEqual(generated.news)
  expect(getLogo('lockup', 'news')).toEqual(generated.news)
  expect(getLogo('wordmark', 'social')).toEqual(generated.mark)
  expect(getLogo('lockup', 'social')).toEqual(generated.mark)
  expect(getLogo('wordmark')).toEqual(generated.mark)
})

it('uses a compact mu mark with news underneath in news builds', () => {
  expect(getLogo('mark', 'news')).toEqual(generated['news-mark'])
  expect(getLogo('icon', 'news')).toEqual(generated['news-mark'])
  expect(getLogo('mark', 'social')).toEqual(generated.mark)
  expect(getLogo('icon', 'social')).toEqual(generated.mark)
  expect(generated['news-mark'].ratio).toBeGreaterThan(generated.mark.ratio)
})

it('uses the compact news identity for the splash while preserving the social hero', () => {
  expect(getLogo('hero', 'news')).toEqual(generated['news-mark'])
  expect(getLogo('hero', 'social')).toEqual(generated.hero)
})

it('ships outlined lettering without a runtime font dependency', () => {
  expect(generated.news.xml).not.toMatch(/<text\b/)
  expect(generated.news.xml).toContain('fill="currentColor"')
  expect(generated.news.ratio).toBeGreaterThan(0)
  expect(generated.news.ratio).toBeLessThan(generated.mark.ratio)
})

it('colors the small news lettering with the accent while preserving the mu tint', () => {
  const xml = substituteLogoColors(generated.news.xml, {primary_500: '#008080'})
  expect(xml).toContain('fill="#008080"')
  expect(xml).toContain('fill="currentColor"')
  expect(xml).not.toContain('theme:')
  expect(
    substituteLogoColors('<path fill="theme:primary_500"/>', {
      primary_500: '#008080',
    }),
  ).toBe('<path fill="#008080"/>')
})
