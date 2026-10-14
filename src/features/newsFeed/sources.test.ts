import {describe, expect, it} from '@jest/globals'

import {topicsAsThemes} from './sources'

describe('topicsAsThemes', () => {
  it('reads the topics of older records as the themes they became', () => {
    expect(topicsAsThemes(['sports', 'arts-culture', 'tech'])).toEqual([
      'sport',
      'culture',
      'tech',
    ])
  })

  it('drops general news, which every topic takes in', () => {
    expect(topicsAsThemes(['general', 'politics'])).toEqual(['politics'])
  })

  it('reads a record of general news only as every topic', () => {
    expect(topicsAsThemes(['general'])).toEqual(['all'])
  })

  it('keeps themes and an unfinished setup as they are', () => {
    expect(topicsAsThemes(['all'])).toEqual(['all'])
    expect(topicsAsThemes(['economy', 'climate'])).toEqual([
      'economy',
      'climate',
    ])
    expect(topicsAsThemes([])).toEqual([])
  })
})
