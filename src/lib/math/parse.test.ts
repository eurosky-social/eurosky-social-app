import {describe, expect, it} from '@jest/globals'

import {hasMath, parseMathTokens} from './parse'

describe('parseMathTokens', () => {
  it('returns a single text token for plain text', () => {
    expect(parseMathTokens('hello world')).toEqual([
      {type: 'text', value: 'hello world'},
    ])
  })

  it('parses inline math', () => {
    expect(parseMathTokens('so $E = mc^2$ then')).toEqual([
      {type: 'text', value: 'so '},
      {type: 'inline', value: 'E = mc^2'},
      {type: 'text', value: ' then'},
    ])
  })

  it('parses display math on one line', () => {
    expect(parseMathTokens('$$\\int_0^1 x\\,dx$$')).toEqual([
      {type: 'block', value: '\\int_0^1 x\\,dx'},
    ])
  })

  it('parses multi-line display math and trims the body', () => {
    expect(parseMathTokens('before\n$$\na + b\n$$\nafter')).toEqual([
      {type: 'text', value: 'before\n'},
      {type: 'block', value: 'a + b'},
      {type: 'text', value: '\nafter'},
    ])
  })

  it('parses several spans', () => {
    expect(parseMathTokens('$a$ and $b$')).toEqual([
      {type: 'inline', value: 'a'},
      {type: 'text', value: ' and '},
      {type: 'inline', value: 'b'},
    ])
  })

  it('leaves prices alone', () => {
    const text = 'it costs $5 and $10 today'
    expect(parseMathTokens(text)).toEqual([{type: 'text', value: text}])
  })

  it('leaves a range of prices alone', () => {
    const text = 'between $5-$6'
    expect(parseMathTokens(text)).toEqual([{type: 'text', value: text}])
  })

  it('does not open a span before whitespace or close one after it', () => {
    expect(parseMathTokens('$ x$')).toEqual([{type: 'text', value: '$ x$'}])
    expect(parseMathTokens('$x $')).toEqual([{type: 'text', value: '$x $'}])
  })

  it('does not let inline math cross a line break', () => {
    const text = '$a\nb$'
    expect(parseMathTokens(text)).toEqual([{type: 'text', value: text}])
  })

  it('leaves a lone dollar as text', () => {
    const text = 'just $ here'
    expect(parseMathTokens(text)).toEqual([{type: 'text', value: text}])
  })

  it('does not treat empty or blank spans as math', () => {
    expect(parseMathTokens('a $$ b')).toEqual([{type: 'text', value: 'a $$ b'}])
    expect(parseMathTokens('$$ $$')).toEqual([{type: 'text', value: '$$ $$'}])
    expect(parseMathTokens('$$$$')).toEqual([{type: 'text', value: '$$$$'}])
  })

  it('unescapes \\$ and never opens a span with it', () => {
    expect(parseMathTokens('pay \\$5 for $x$')).toEqual([
      {type: 'text', value: 'pay $5 for '},
      {type: 'inline', value: 'x'},
    ])
  })

  it('handles adjacent inline spans', () => {
    expect(parseMathTokens('$x$$y$')).toEqual([
      {type: 'inline', value: 'x'},
      {type: 'inline', value: 'y'},
    ])
  })

  it('allows a dollar sign after math when it is not a digit', () => {
    expect(parseMathTokens('$x$, then')).toEqual([
      {type: 'inline', value: 'x'},
      {type: 'text', value: ', then'},
    ])
  })
})

describe('hasMath', () => {
  it('is false for plain text and prices', () => {
    expect(hasMath('no math here')).toBe(false)
    expect(hasMath('$5 and $10')).toBe(false)
    expect(hasMath('only escaped \\$5')).toBe(false)
    expect(hasMath('blank $$ $$')).toBe(false)
  })

  it('is true for inline and display math', () => {
    expect(hasMath('has $x$')).toBe(true)
    expect(hasMath('$$x$$')).toBe(true)
  })

  it('is repeatable (regex lastIndex is reset)', () => {
    expect(hasMath('has $x$')).toBe(true)
    expect(hasMath('has $x$')).toBe(true)
  })
})
