import {describe, expect, it} from '@jest/globals'

import {getEmojiAt, insertEmojiAt} from '../emoji-manip'

describe('getEmojiAt', () => {
  it('finds a shortcode query at the beginning of the text', () => {
    expect(getEmojiAt(':wav', 4)).toEqual({value: 'wav', index: 0})
  })

  it('finds a shortcode query after whitespace', () => {
    expect(getEmojiAt('hello :waving_hand', 18)).toEqual({
      value: 'waving_hand',
      index: 6,
    })
  })

  it('finds a query when the cursor is within it', () => {
    expect(getEmojiAt(':wave later', 3)).toEqual({value: 'wave', index: 0})
  })

  it('does not treat colons inside words or URLs as triggers', () => {
    expect(getEmojiAt('time:wave', 9)).toBeUndefined()
    expect(getEmojiAt('https://example.com:8080', 24)).toBeUndefined()
  })

  it('does not include a completed shortcode at either cursor position', () => {
    expect(getEmojiAt(':wave:', 5)).toBeUndefined()
    expect(getEmojiAt(':wave:', 6)).toBeUndefined()
  })
})

describe('insertEmojiAt', () => {
  it('replaces the active shortcode and adds a trailing space', () => {
    expect(insertEmojiAt('hello :wav', 10, '👋')).toBe('hello 👋 ')
  })

  it('does not duplicate existing whitespace', () => {
    expect(insertEmojiAt('hello :wav world', 10, '👋')).toBe('hello 👋 world')
  })

  it('preserves text when there is no shortcode at the cursor', () => {
    expect(insertEmojiAt('hello world', 5, '👋')).toBe('hello world')
  })

  it('does not replace a completed shortcode using a stale cursor', () => {
    expect(insertEmojiAt(':wave:', 5, '👋')).toBe(':wave:')
  })
})
