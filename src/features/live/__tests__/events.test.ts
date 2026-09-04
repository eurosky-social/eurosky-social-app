import {
  getStreamPlayer,
  liveEventFromPost,
  parsePostReference,
  streamKey,
  streamUrlVariants,
} from '../events'

describe('streamKey', () => {
  it('canonicalizes the ways a YouTube stream is shared', () => {
    const forms = [
      'https://www.youtube.com/watch?v=WQ_yEcikVDw',
      'https://youtube.com/watch?v=WQ_yEcikVDw&t=30s',
      'https://m.youtube.com/watch?v=WQ_yEcikVDw',
      'https://youtu.be/WQ_yEcikVDw',
      'https://www.youtube.com/live/WQ_yEcikVDw?si=abc',
    ]
    for (const url of forms) {
      expect(streamKey(url)).toBe('youtube:WQ_yEcikVDw')
    }
  })

  it('canonicalizes Twitch channels, videos and clips', () => {
    expect(streamKey('https://www.twitch.tv/Monstercat')).toBe(
      'twitch:monstercat',
    )
    expect(streamKey('https://twitch.tv/videos/123')).toBe('twitch:video:123')
    expect(streamKey('https://twitch.tv/chan/clip/Abc')).toBe('twitch:clip:Abc')
  })

  it('canonicalizes Streamplace channels and their embed pages', () => {
    expect(streamKey('https://stream.place/iame.li')).toBe(
      'streamplace:iame.li',
    )
    expect(streamKey('https://stream.place/embed/iame.li')).toBe(
      'streamplace:iame.li',
    )
  })

  it('falls back to host and path for other hosts', () => {
    expect(streamKey('https://www.example.org/Live/')).toBe('example.org/live')
    expect(streamKey('not a url')).toBeUndefined()
  })
})

describe('streamUrlVariants', () => {
  it('expands a YouTube link to its shared forms', () => {
    const variants = streamUrlVariants('https://youtu.be/WQ_yEcikVDw')
    expect(variants).toContain('https://www.youtube.com/watch?v=WQ_yEcikVDw')
    expect(variants).toContain('https://www.youtube.com/live/WQ_yEcikVDw')
    expect(new Set(variants.map(streamKey)).size).toBe(1)
  })

  it('does not expand Twitch videos or clips into channel links', () => {
    expect(streamUrlVariants('https://twitch.tv/chan/clip/Abc')).toEqual([
      'https://twitch.tv/chan/clip/Abc',
    ])
  })

  it('returns the input for unknown hosts', () => {
    expect(streamUrlVariants('https://example.org/x')).toEqual([
      'https://example.org/x',
    ])
  })
})

describe('getStreamPlayer', () => {
  it('accepts hosts that play inline and rejects the rest', () => {
    expect(getStreamPlayer('https://www.youtube.com/watch?v=abc')?.type).toBe(
      'youtube_video',
    )
    expect(getStreamPlayer('https://www.twitch.tv/monstercat')?.type).toBe(
      'twitch_video',
    )
    expect(getStreamPlayer('https://stream.place/iame.li')).toEqual({
      type: 'streamplace_live',
      source: 'streamplace',
      playerUri: 'https://stream.place/embed/iame.li',
    })
    // Site pages are not channels: handles are domains.
    expect(getStreamPlayer('https://stream.place/docs')).toBeUndefined()
    // Recordings are not the live channel.
    expect(
      getStreamPlayer('https://stream.place/atproto.nyc/video/3mtyot3tqhw77'),
    ).toBeUndefined()
    expect(getStreamPlayer('nonsense')).toBeUndefined()
  })
})

describe('parsePostReference', () => {
  it('reads at-uris and web post links on any host', () => {
    expect(
      parsePostReference('at://did:plc:abc/app.bsky.feed.post/3k2'),
    ).toEqual({actor: 'did:plc:abc', rkey: '3k2'})
    expect(
      parsePostReference(
        'https://mu.social/profile/liveonmu.eurosky.social/post/3muoyv3ugoc2a',
      ),
    ).toEqual({actor: 'liveonmu.eurosky.social', rkey: '3muoyv3ugoc2a'})
    expect(parsePostReference('https://bsky.app/profile/x.bsky.social')).toBe(
      undefined,
    )
  })
})

describe('liveEventFromPost', () => {
  it('turns a post with a playable link into an event anchored on the post', () => {
    const event = liveEventFromPost({
      uri: 'at://did:plc:abc/app.bsky.feed.post/3k2',
      authorDid: 'did:plc:abc',
      createdAt: '2026-09-04T12:00:00.000Z',
      text: 'Go Everton! www.youtube.com/watch?v=WQ_y...',
      external: {
        uri: 'https://www.youtube.com/watch?v=WQ_yEcikVDw',
        title: 'Press conference',
      },
      links: ['https://www.youtube.com/watch?v=WQ_yEcikVDw'],
    })
    expect(event).toMatchObject({
      id: '3k2',
      title: 'Press conference',
      description: 'Go Everton!',
      hostDid: 'did:plc:abc',
      anchorPostUri: 'at://did:plc:abc/app.bsky.feed.post/3k2',
      startsAt: '2026-09-04T12:00:00.000Z',
    })
    expect(event?.endsAt).toBe('2026-09-05T00:00:00.000Z')
  })

  it('ignores posts without a playable link', () => {
    expect(
      liveEventFromPost({
        uri: 'at://did:plc:abc/app.bsky.feed.post/3k3',
        authorDid: 'did:plc:abc',
        createdAt: '2026-09-04T12:00:00.000Z',
        text: 'read this',
        links: ['https://example.org/article'],
      }),
    ).toBeUndefined()
  })
})
