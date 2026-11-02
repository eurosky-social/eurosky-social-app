import {type ModerationOpts} from '@bsky/sdk/moderation'
import {describe, expect, it, jest} from '@jest/globals'

import {type app} from '#/lexicons'
import {pickerArticles, previewPosts} from './items'

jest.mock('@bsky/sdk/moderation', () => ({
  moderatePost: (post: {record: {text: string}}) => ({
    ui: () => ({filter: post.record.text === 'filtered'}),
  }),
  mergeModUIResults: (...results: {filter?: boolean}[]) => ({
    filter: results.some(value => value?.filter),
  }),
}))
const DID = 'did:plc:y57igqldvutzs7gpmmrrqbw7'
const opts = {} as ModerationOpts
function entry(
  id: string,
  did: app.bsky.actor.defs.ProfileViewBasic['did'] = DID,
): app.bsky.feed.defs.FeedViewPost {
  return {
    post: {
      uri: `at://${did}/app.bsky.feed.post/${id}`,
      cid: 'bafytest',
      author: {did, handle: 'test.example'},
      indexedAt: '2026-10-28T12:00:00Z',
      record: {
        $type: 'app.bsky.feed.post',
        text: id,
        createdAt: '2026-10-28T12:00:00Z',
      },
    },
  }
}

describe('latest-post slot previews', () => {
  it('shows only the first two valid, unfiltered posts in source-feed order', () => {
    const result = previewPosts(
      [
        entry('one', 'did:plc:other'),
        entry('one', 'did:plc:other'),
        entry('filtered'),
        entry('two'),
        entry('three'),
        entry('four'),
      ],
      opts,
    )
    expect(result.map(item => item.record.text)).toEqual(['one', 'two'])
    expect(result[0].post.author.did).toBe('did:plc:other')
  })
})

describe('post slot candidates', () => {
  it('uses only the account’s own original posts, excluding replies and reposts', () => {
    const reply = entry('reply')
    reply.post.record = {
      ...reply.post.record,
      reply: {
        root: {uri: entry('root').post.uri, cid: 'bafytest'},
        parent: {uri: entry('root').post.uri, cid: 'bafytest'},
      },
    }
    const repost = entry('repost')
    repost.reason = {
      $type: 'app.bsky.feed.defs#reasonRepost',
      by: {did: DID, handle: 'test.example'},
      indexedAt: '2026-10-28T12:00:00Z',
    }
    const result = pickerArticles(
      [entry('one'), reply, repost, entry('other', 'did:plc:other')],
      DID,
      opts,
    )
    expect(result.map(value => value.title)).toEqual(['one'])
  })

  it('ignores malformed and filtered posts and deduplicates pages by post URI', () => {
    const malformed = entry('bad')
    malformed.post.record = {text: 'missing createdAt'}
    expect(
      pickerArticles(
        [entry('one'), entry('one'), malformed, entry('filtered')],
        DID,
        opts,
      ).map(value => value.title),
    ).toEqual(['one'])
  })
})
