import {describe, expect, it} from '@jest/globals'

import {exToPx, getCachedTypeset, parseSvg, typeset} from './mathjax'

describe('typeset', () => {
  it('renders inline TeX to a standalone SVG with metrics', async () => {
    const result = await typeset('E = mc^2', false)
    expect(result).not.toBeNull()
    expect(result!.svg.startsWith('<svg')).toBe(true)
    expect(result!.svg.endsWith('</svg>')).toBe(true)
    expect(result!.svg).toContain('currentColor')
    expect(result!.widthEx).toBeGreaterThan(0)
    expect(result!.heightEx).toBeGreaterThan(0)
  })

  it('drops the root style attribute but keeps its vertical-align', async () => {
    const result = await typeset('\\frac{a}{b}', false)
    expect(result!.svg).not.toMatch(/^<svg[^>]*\sstyle=/)
    // A fraction hangs below the baseline.
    expect(result!.verticalAlignEx).toBeLessThan(0)
  })

  it('renders display math', async () => {
    const result = await typeset('\\int_0^1 x\\,dx', true)
    expect(result).not.toBeNull()
    expect(result!.svg).toContain('<svg')
  })

  it('does not reject malformed TeX', async () => {
    const result = await typeset('\\frac{1', false)
    expect(result).not.toBeNull()
  })

  it('caches results by input and mode', async () => {
    const first = await typeset('x_1', false)
    expect(getCachedTypeset('x_1', false)).toBe(first)
    expect(await typeset('x_1', false)).toBe(first)
    expect(getCachedTypeset('x_1', true)).toBeNull()
  })
})

describe('parseSvg', () => {
  it('extracts the svg and its ex metrics', () => {
    const markup =
      '<mjx-container class="MathJax" jax="SVG">' +
      '<svg style="vertical-align: -0.566ex" xmlns="http://www.w3.org/2000/svg" width="6.5ex" height="2.262ex" viewBox="0 -750 2873 1000">' +
      '<g fill="currentColor"></g></svg></mjx-container>'
    expect(parseSvg(markup)).toEqual({
      svg: '<svg xmlns="http://www.w3.org/2000/svg" width="6.5ex" height="2.262ex" viewBox="0 -750 2873 1000"><g fill="currentColor"></g></svg>',
      widthEx: 6.5,
      heightEx: 2.262,
      verticalAlignEx: -0.566,
    })
  })

  it('returns null when there is no svg', () => {
    expect(parseSvg('<mjx-container></mjx-container>')).toBeNull()
  })
})

describe('exToPx', () => {
  it('uses the same ex factor MathJax assumed', () => {
    expect(exToPx(2, 16)).toBe(16)
  })
})
