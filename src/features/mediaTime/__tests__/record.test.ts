import {RichText} from '@bsky/sdk/richtext'
import {describe, expect, it} from '@jest/globals'

import {
  appendMediaTimeLink,
  formatMediaTime,
  getMediaTime,
  getMediaTimeLinkGraphemes,
  getMediaTimeLinkText,
  getOwnVideoEmbed,
  MEDIA_TIME_FIELD,
  parseMediaTimeLink,
  parseMediaTimeParam,
} from '../record'

const VIDEO_POST = 'at://did:plc:alice/app.bsky.feed.post/3lvideo'

/** Reads the text a facet covers, using its UTF-8 byte offsets. */
function facetText(
  text: string,
  facet: {index: {byteStart: number; byteEnd: number}},
) {
  const bytes = new TextEncoder().encode(text)
  return new TextDecoder().decode(
    bytes.slice(facet.index.byteStart, facet.index.byteEnd),
  )
}

describe('formatMediaTime', () => {
  it.each([
    [0, '0:00'],
    [41, '0:41'],
    [125, '2:05'],
    [3599, '59:59'],
    [3723, '1:02:03'],
    [41.9, '0:41'],
  ])('formats %s seconds as %s', (seconds, expected) => {
    expect(formatMediaTime(seconds)).toBe(expected)
  })
})

describe('parseMediaTimeParam', () => {
  it.each([
    ['41', 41],
    ['0', 0],
    ['360000', 360000],
  ])('accepts %s', (value, expected) => {
    expect(parseMediaTimeParam(value)).toBe(expected)
  })

  it.each([undefined, null, '', '1m30s', '-3', '4.5', ' 41', '360001'])(
    'rejects %s',
    value => {
      expect(parseMediaTimeParam(value)).toBeUndefined()
    },
  )
})

describe('getMediaTime', () => {
  it('reads the field written by the app', () => {
    expect(
      getMediaTime({
        text: 'hi',
        [MEDIA_TIME_FIELD]: {$type: MEDIA_TIME_FIELD, seconds: 41},
      }),
    ).toBe(41)
  })

  it.each([
    ['no field', {text: 'hi'}],
    ['a string', {[MEDIA_TIME_FIELD]: {seconds: '41'}}],
    ['a negative time', {[MEDIA_TIME_FIELD]: {seconds: -1}}],
    ['a fraction', {[MEDIA_TIME_FIELD]: {seconds: 4.5}}],
    ['more than 100 hours', {[MEDIA_TIME_FIELD]: {seconds: 360001}}],
    ['another $type', {[MEDIA_TIME_FIELD]: {$type: 'x.y.z', seconds: 4}}],
  ])('ignores %s', (_name, record) => {
    expect(getMediaTime(record)).toBeUndefined()
  })

  it('ignores non-objects', () => {
    expect(getMediaTime(undefined)).toBeUndefined()
    expect(getMediaTime('text')).toBeUndefined()
  })
})

describe('appendMediaTimeLink', () => {
  it('adds the link at the end with correct byte offsets', () => {
    const rt = new RichText({text: 'Wow 🔥 https://example.com'})
    rt.detectFacetsWithoutResolution()
    const result = appendMediaTimeLink(rt, {
      videoPostUri: VIDEO_POST,
      seconds: 41,
    })

    expect(result.text).toBe(
      `Wow 🔥 https://example.com ${getMediaTimeLinkText(41)}`,
    )
    expect(result.facets).toHaveLength(2)
    expect(facetText(result.text, result.facets![0])).toBe(
      'https://example.com',
    )
    const timeFacet = result.facets![1]
    expect(facetText(result.text, timeFacet)).toBe(getMediaTimeLinkText(41))
    const feature = timeFacet.features[0] as {$type: string; uri: string}
    expect(feature.$type).toBe('app.bsky.richtext.facet#link')
    expect(feature.uri).toMatch(
      /^https:\/\/[^/]+\/profile\/did:plc:alice\/post\/3lvideo\?t=41$/,
    )
  })

  it('adds no space before the link when the text is empty', () => {
    const result = appendMediaTimeLink(
      {text: ''},
      {videoPostUri: VIDEO_POST, seconds: 5},
    )
    expect(result.text).toBe(getMediaTimeLinkText(5))
    expect(result.facets![0].index.byteStart).toBe(0)
  })

  it('leaves the text alone for an invalid post URI', () => {
    const result = appendMediaTimeLink(
      {text: 'hi'},
      {videoPostUri: 'not a uri', seconds: 5},
    )
    expect(result).toEqual({text: 'hi', facets: undefined})
  })
})

describe('getMediaTimeLinkGraphemes', () => {
  it('counts the space and the link text', () => {
    // space, play symbol (one grapheme with its selector), space, "0:41"
    expect(getMediaTimeLinkGraphemes(41)).toBe(7)
    expect(getMediaTimeLinkGraphemes(3723)).toBe(10)
  })
})

describe('parseMediaTimeLink', () => {
  it('recognises links written by appendMediaTimeLink', () => {
    const {text, facets} = appendMediaTimeLink(
      {text: 'At this point'},
      {videoPostUri: VIDEO_POST, seconds: 3723},
    )
    const facet = facets!.at(-1)!
    const uri = (facet.features[0] as {uri: string}).uri
    expect(parseMediaTimeLink(uri, facetText(text, facet))).toEqual({
      videoPostUri: VIDEO_POST,
      seconds: 3723,
    })
  })

  it('accepts other hosts and text without the selector', () => {
    expect(
      parseMediaTimeLink(
        'https://oso.example/profile/did:web:a.example/post/3abc?t=9',
        '▶ 0:09',
      ),
    ).toEqual({
      videoPostUri: 'at://did:web:a.example/app.bsky.feed.post/3abc',
      seconds: 9,
    })
  })

  it.each([
    [
      'other text',
      'https://mu.social/profile/did:plc:a/post/3abc?t=9',
      'watch',
    ],
    [
      'plain http',
      'http://mu.social/profile/did:plc:a/post/3abc?t=9',
      '▶ 0:09',
    ],
    [
      'a handle',
      'https://mu.social/profile/a.bsky.social/post/3abc?t=9',
      '▶ 0:09',
    ],
    ['no time', 'https://mu.social/profile/did:plc:a/post/3abc', '▶ 0:09'],
    [
      'a bad time',
      'https://mu.social/profile/did:plc:a/post/3abc?t=9s',
      '▶ 0:09',
    ],
    [
      'a sub-page',
      'https://mu.social/profile/did:plc:a/post/3abc/quotes?t=9',
      '▶ 0:09',
    ],
    ['not a URL', 'mu.social/profile', '▶ 0:09'],
  ])('rejects %s', (_name, uri, text) => {
    expect(parseMediaTimeLink(uri, text)).toBeUndefined()
  })
})

describe('getOwnVideoEmbed', () => {
  const video = {
    $type: 'app.bsky.embed.video#view',
    cid: 'bafy',
    playlist: 'https://video.example/playlist.m3u8',
  }

  it('returns a video embed', () => {
    expect(getOwnVideoEmbed(video as never)).toBe(video)
  })

  it('returns the video of a post that also quotes another post', () => {
    const embed = {
      $type: 'app.bsky.embed.recordWithMedia#view',
      record: {$type: 'app.bsky.embed.record#view', record: {}},
      media: video,
    }
    expect(getOwnVideoEmbed(embed as never)).toBe(video)
  })

  it('ignores other embeds and a quoted post with a video', () => {
    expect(
      getOwnVideoEmbed({$type: 'app.bsky.embed.images#view'} as never),
    ).toBeUndefined()
    expect(
      getOwnVideoEmbed({
        $type: 'app.bsky.embed.record#view',
        record: {embeds: [video]},
      } as never),
    ).toBeUndefined()
    expect(getOwnVideoEmbed(undefined)).toBeUndefined()
  })
})
