import {type Client} from '@atproto/lex'
import {updatePreferences} from '@bsky/sdk'

import {app, com} from '#/lexicons'
import {
  makeDefaultNewsFeedPrefs,
  NEWS_FEED_PREFS_NSID,
  NEWS_PREFS_TYPE,
  readNewsFeedPrefs,
  writeNewsFeedPrefs,
} from './prefs'

// The hooks' session context pulls in the whole UI; only the helpers are tested.
jest.mock('#/state/session', () => ({}))

const did = 'did:plc:reader'
const prefs = {
  ...makeDefaultNewsFeedPrefs(),
  topics: ['tech'],
  createdAt: '2026-10-15T00:00:00.000Z',
}
const adultContent = {
  $type: 'app.bsky.actor.defs#adultContentPref',
  enabled: true,
}

function notFound() {
  return new Error('Could not locate record: self')
}

describe('readNewsFeedPrefs', () => {
  it('reads the private preference, without proxying to an AppView', async () => {
    const call = jest.fn().mockResolvedValue({
      preferences: [adultContent, {$type: NEWS_PREFS_TYPE, ...prefs}],
    })

    await expect(
      readNewsFeedPrefs({call} as unknown as Client, did),
    ).resolves.toMatchObject({topics: ['tech']})
    expect(call).toHaveBeenCalledTimes(1)
    expect(call).toHaveBeenCalledWith(
      app.bsky.actor.getPreferences,
      {},
      {service: null},
    )
  })

  it('falls back to the old public record', async () => {
    const call = jest
      .fn()
      .mockResolvedValueOnce({preferences: [adultContent]})
      .mockResolvedValueOnce({value: {$type: NEWS_FEED_PREFS_NSID, ...prefs}})

    await expect(
      readNewsFeedPrefs({call} as unknown as Client, did),
    ).resolves.toMatchObject({topics: ['tech']})
    expect(call).toHaveBeenLastCalledWith(com.atproto.repo.getRecord, {
      repo: did,
      collection: NEWS_FEED_PREFS_NSID,
      rkey: 'self',
    })
  })

  it('is null when neither exists', async () => {
    const call = jest
      .fn()
      .mockResolvedValueOnce({preferences: []})
      .mockRejectedValueOnce(notFound())

    await expect(
      readNewsFeedPrefs({call} as unknown as Client, did),
    ).resolves.toBeNull()
  })
})

describe('writeNewsFeedPrefs', () => {
  function run(next: typeof prefs | null, current: unknown[]) {
    let written: unknown
    const call = jest.fn((method: unknown, input: unknown) => {
      if (method === updatePreferences) {
        written = (input as (p: unknown[]) => unknown)(current)
      }
      return Promise.resolve()
    })
    return {
      call,
      done: writeNewsFeedPrefs({call} as unknown as Client, did, next),
      written: () => written,
    }
  }

  it('replaces only the news preference, then deletes the public record', async () => {
    const {call, done, written} = run(prefs, [
      adultContent,
      {$type: NEWS_PREFS_TYPE, ...makeDefaultNewsFeedPrefs()},
    ])
    await done

    expect(written()).toEqual([
      adultContent,
      {...prefs, $type: NEWS_PREFS_TYPE},
    ])
    expect(call).toHaveBeenLastCalledWith(com.atproto.repo.deleteRecord, {
      repo: did,
      collection: NEWS_FEED_PREFS_NSID,
      rkey: 'self',
    })
  })

  it('removes the news preference on reset', async () => {
    const {done, written} = run(null, [
      adultContent,
      {$type: NEWS_PREFS_TYPE, ...prefs},
    ])
    await done

    expect(written()).toEqual([adultContent])
  })
})
