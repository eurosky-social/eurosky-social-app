import {describe, expect, it, jest} from '@jest/globals'

import {
  fetchVideoDuration,
  playlistSeconds,
  variantPlaylistUrl,
} from '../videoDuration'

const MASTER_URL =
  'https://video.bsky.app/watch/did%3Aplc%3Aabc/bafkrei/playlist.m3u8'

// As Bluesky's video service serves them (2026-11).
const MASTER = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:PROGRAM-ID=0,BANDWIDTH=1326528,RESOLUTION=640x360
360p/video.m3u8?session_id=dc44
#EXT-X-STREAM-INF:PROGRAM-ID=0,BANDWIDTH=4473648,RESOLUTION=1280x720
720p/video.m3u8?session_id=dc44
`
const MEDIA = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-TARGETDURATION:6
#EXTINF:6.000,
video0.ts?dur=6.000000
#EXTINF:6.000,
video1.ts?dur=6.000000
#EXTINF:6.000,
video2.ts
#EXTINF:6.000,
video3.ts
#EXTINF:6.000,
video4.ts
#EXTINF:0.667,
video5.ts
#EXT-X-ENDLIST
`

describe('variantPlaylistUrl', () => {
  it('takes the first variant, next to the main playlist', () => {
    expect(variantPlaylistUrl(MASTER, `${MASTER_URL}?x=1`)).toBe(
      'https://video.bsky.app/watch/did%3Aplc%3Aabc/bafkrei/360p/video.m3u8?session_id=dc44',
    )
  })

  it('keeps a variant given in full', () => {
    const master = MASTER.replace(
      '360p/video.m3u8?session_id=dc44',
      'https://cdn.example/v/360.m3u8',
    )
    expect(variantPlaylistUrl(master, MASTER_URL)).toBe(
      'https://cdn.example/v/360.m3u8',
    )
  })

  it('uses the playlist itself when it lists segments', () => {
    expect(variantPlaylistUrl(MEDIA, MASTER_URL)).toBe(MASTER_URL)
  })

  it('finds nothing in something else', () => {
    expect(variantPlaylistUrl('<html></html>', MASTER_URL)).toBeUndefined()
  })
})

describe('playlistSeconds', () => {
  it('adds up the segments', () => {
    expect(playlistSeconds(MEDIA)).toBeCloseTo(30.667, 3)
  })

  it('knows nothing of a playlist that is not finished', () => {
    expect(playlistSeconds(MEDIA.replace('#EXT-X-ENDLIST', ''))).toBeUndefined()
  })

  it('knows nothing of a playlist without segments', () => {
    expect(playlistSeconds('#EXTM3U\n#EXT-X-ENDLIST\n')).toBeUndefined()
  })
})

describe('fetchVideoDuration', () => {
  it('reads the main playlist, then the first variant', async () => {
    const fetchText = jest.fn((url: string) =>
      Promise.resolve(url === MASTER_URL ? MASTER : MEDIA),
    )
    await expect(
      fetchVideoDuration(MASTER_URL, fetchText),
    ).resolves.toBeCloseTo(30.667, 3)
    expect(fetchText.mock.calls.map(([url]) => url)).toEqual([
      MASTER_URL,
      'https://video.bsky.app/watch/did%3Aplc%3Aabc/bafkrei/360p/video.m3u8?session_id=dc44',
    ])
  })

  it('needs one request when the playlist lists segments itself', async () => {
    const fetchText = jest.fn((_url: string) => Promise.resolve(MEDIA))
    await expect(
      fetchVideoDuration(MASTER_URL, fetchText),
    ).resolves.toBeCloseTo(30.667, 3)
    expect(fetchText).toHaveBeenCalledTimes(1)
  })
})
