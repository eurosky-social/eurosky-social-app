import Emojis, {type EmojiMartData} from '@emoji-mart/data'
import {describe, expect, it} from '@jest/globals'

import {findExactEmoji} from './useEmojiSearch'

const data = Emojis as EmojiMartData

describe('findExactEmoji', () => {
  it('resolves an exact canonical shortcode', () => {
    expect(findExactEmoji(data, 'kiss')?.id).toBe('kiss')
  })

  it('resolves an exact alias', () => {
    expect(findExactEmoji(data, 'thumbsup')?.id).toBe('+1')
  })

  it('is case insensitive', () => {
    expect(findExactEmoji(data, 'KISS')?.id).toBe('kiss')
  })

  it('does not resolve a fuzzy match', () => {
    expect(findExactEmoji(data, 'kis')).toBeUndefined()
  })
})
