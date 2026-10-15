import {type app} from '#/lexicons'
import {getTileRef, getTileRefFromRecordEmbed} from './record'

const TILE = 'at://did:plc:izttpdp3l6vss5crelt5kcux/ing.dasl.masl/3mcjwwoqjqs2v'

function external(tile: unknown) {
  return {
    $type: 'app.bsky.embed.external',
    external: {
      uri: 'https://mu.social/profile/alice.test/post/3abc',
      title: 'Minesweeper',
      description: 'A tile',
      tile,
    },
  }
}

function post(embed: unknown): app.bsky.feed.defs.PostView {
  return {
    uri: 'at://did:plc:alice/app.bsky.feed.post/3abc',
    cid: 'bafy',
    author: {did: 'did:plc:alice', handle: 'alice.test'},
    indexedAt: '2026-10-15T00:00:00.000Z',
    record: {
      $type: 'app.bsky.feed.post',
      text: '',
      createdAt: '2026-10-15T00:00:00.000Z',
      embed,
    },
  } as unknown as app.bsky.feed.defs.PostView
}

describe('getTileRefFromRecordEmbed', () => {
  it('reads the pointer off an external embed', () => {
    expect(
      getTileRefFromRecordEmbed(external({uri: TILE, cid: 'bafytile'})),
    ).toEqual({uri: TILE, cid: 'bafytile'})
  })

  it('reads the pointer off the media of a quote with media', () => {
    expect(
      getTileRefFromRecordEmbed({
        $type: 'app.bsky.embed.recordWithMedia',
        record: {
          $type: 'app.bsky.embed.record',
          record: {uri: 'at://x/app.bsky.feed.post/y', cid: 'bafy'},
        },
        media: external({uri: TILE}),
      }),
    ).toEqual({uri: TILE, cid: undefined})
  })

  it('ignores cards without a pointer or with a bad one', () => {
    expect(getTileRefFromRecordEmbed(external(undefined))).toBe(undefined)
    expect(getTileRefFromRecordEmbed(external({uri: 'https://x.test'}))).toBe(
      undefined,
    )
    expect(getTileRefFromRecordEmbed(external('nope'))).toBe(undefined)
    expect(
      getTileRefFromRecordEmbed({
        $type: 'app.bsky.embed.images',
        images: [],
      }),
    ).toBe(undefined)
    expect(getTileRefFromRecordEmbed(undefined)).toBe(undefined)
  })
})

describe('getTileRef', () => {
  it('reads the pointer from the post record', () => {
    expect(getTileRef(post(external({uri: TILE})))).toEqual({
      uri: TILE,
      cid: undefined,
    })
    expect(getTileRef(post(undefined))).toBe(undefined)
    expect(getTileRef(undefined)).toBe(undefined)
  })
})
