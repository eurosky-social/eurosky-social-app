import {type Client} from '@atproto/lex'
import {getPreferences, overwriteSavedFeeds, upsertNux} from '@bsky/sdk'

import {
  DISCOVER_FEED_URI,
  DISCOVER_SAVED_FEED,
  FU_FEED_URI,
  FU_SAVED_FEED,
  RECOMMENDED_SAVED_FEEDS,
  TIMELINE_SAVED_FEED,
  VIDEO_FEED_URI,
} from '#/lib/constants'
import {Nux} from '#/state/queries/nuxs/definitions'
import {type app} from '#/lexicons'
import {
  getOnboardingFeeds,
  pinMuForYouFeed,
  prependMuForYouFeed,
  saveOnboardingFeeds,
} from './preferences'

const following = {...TIMELINE_SAVED_FEED, id: 'following'}
const discover = {...DISCOVER_SAVED_FEED, id: 'discover'}
const savedList = {
  type: 'list',
  value: 'at://did:plc:example/app.bsky.graph.list/list',
  pinned: false,
  id: 'list',
}

describe('onboarding defaults', () => {
  it('pins Mu first instead of Discover, followed by Following and Video', () => {
    const feeds = getOnboardingFeeds()
    expect(feeds.map(feed => feed.value)).toEqual([
      FU_FEED_URI,
      'following',
      VIDEO_FEED_URI,
    ])
    expect(feeds.every(feed => feed.pinned && feed.id)).toBe(true)
    expect(new Set(feeds.map(feed => feed.id)).size).toBe(feeds.length)
    expect(RECOMMENDED_SAVED_FEEDS[0]).toEqual(FU_SAVED_FEED)
  })

  it('retains starter-pack feeds after defaults without duplicating them', () => {
    const feeds = getOnboardingFeeds([
      {uri: FU_FEED_URI},
      {uri: DISCOVER_FEED_URI},
      {uri: VIDEO_FEED_URI},
      {uri: DISCOVER_FEED_URI},
    ])
    expect(feeds.map(feed => feed.value)).toEqual([
      FU_FEED_URI,
      'following',
      VIDEO_FEED_URI,
      DISCOVER_FEED_URI,
    ])
  })

  it('writes defaults and suppresses the opt-in for new accounts on the server', async () => {
    const call = jest.fn().mockResolvedValue(undefined)
    await saveOnboardingFeeds({call} as unknown as Client)
    expect(call.mock.calls[0]).toEqual([
      overwriteSavedFeeds,
      expect.arrayContaining([
        expect.objectContaining({value: FU_FEED_URI, pinned: true}),
      ]),
    ])
    expect(call.mock.calls[1]).toEqual([
      upsertNux,
      {id: Nux.MuForYouFeedAnnouncement, completed: true},
    ])
  })

  it('does not mark the announcement complete if saving feeds fails', async () => {
    const call = jest.fn().mockRejectedValue(new Error('offline'))
    await expect(
      saveOnboardingFeeds({call} as unknown as Client),
    ).rejects.toThrow('offline')
    expect(call).toHaveBeenCalledTimes(1)
  })
})

describe('existing account opt-in', () => {
  it('prepends Mu without removing Discover or changing other feeds', () => {
    const existing = [following, discover, savedList]
    const result = prependMuForYouFeed(existing)
    expect(result[0]).toMatchObject({...FU_SAVED_FEED, id: expect.any(String)})
    expect(result.slice(1)).toEqual(existing)
    expect(existing).toEqual([following, discover, savedList])
  })

  it.each([false, true])('reuses a saved feed ID (pinned=%s)', pinned => {
    const mu = {...FU_SAVED_FEED, id: 'existing-mu', pinned}
    const result = prependMuForYouFeed([following, mu, discover, savedList])
    expect(result).toEqual([
      {...mu, pinned: true},
      following,
      discover,
      savedList,
    ])
    expect(mu.pinned).toBe(pinned)
    expect(prependMuForYouFeed(result)).toEqual(result)
  })

  it('removes duplicate Mu entries without duplicating or dropping other feeds', () => {
    const result = prependMuForYouFeed([
      following,
      {...FU_SAVED_FEED, id: 'mu-1', pinned: false},
      {...FU_SAVED_FEED, id: 'mu-2'},
      savedList,
    ])
    expect(result.map(feed => feed.id)).toEqual(['mu-1', 'following', 'list'])
  })

  it('works with no saved feeds', () => {
    expect(prependMuForYouFeed([])).toEqual([
      expect.objectContaining(FU_SAVED_FEED),
    ])
  })

  it('reads current server preferences before writing, preserving unknown feed types', async () => {
    const feeds: app.bsky.actor.defs.SavedFeed[] = [
      following,
      discover,
      savedList,
      {id: 'future', type: 'unknown', value: 'future-feed', pinned: false},
    ]
    const call = jest
      .fn()
      .mockResolvedValueOnce({savedFeeds: feeds})
      .mockResolvedValueOnce(undefined)
    await pinMuForYouFeed({call} as unknown as Client)
    expect(call.mock.calls[0]).toEqual([getPreferences])
    expect(call).toHaveBeenNthCalledWith(2, overwriteSavedFeeds, [
      expect.objectContaining(FU_SAVED_FEED),
      ...feeds,
    ])
  })

  it('never overwrites feeds when the fresh preferences read fails', async () => {
    const call = jest.fn().mockRejectedValue(new Error('offline'))
    await expect(pinMuForYouFeed({call} as unknown as Client)).rejects.toThrow(
      'offline',
    )
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('surfaces write failures so the dialog can offer a retry', async () => {
    const call = jest
      .fn()
      .mockResolvedValueOnce({savedFeeds: [following]})
      .mockRejectedValueOnce(new Error('write failed'))
    await expect(pinMuForYouFeed({call} as unknown as Client)).rejects.toThrow(
      'write failed',
    )
  })
})
