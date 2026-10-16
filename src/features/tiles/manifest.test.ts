import {parseCid} from '@atproto/lex'

import {
  tileBlobUrl,
  type TileManifest,
  tileResourceCid,
  tileScreenshotUrl,
} from './manifest'

const manifest = {
  name: 'Minesweeper',
  resources: {
    '/': {src: {$link: 'bafyroot'}, 'content-type': 'text/html'},
    '/shot.png': {
      src: {
        $type: 'blob',
        ref: {$link: 'bafyshot'},
        mimeType: 'image/png',
        size: 1,
      },
      'content-type': 'image/png',
    },
  },
  screenshots: [{src: '/shot.png'}],
} as unknown as TileManifest

// The app's jest setup stubs multiformats' CID; these tests need the real one.
jest.unmock('multiformats/cid')

/*
 * What the same record looks like after the lex client has parsed it: every
 * `{$link}` is a `Cid` instance. Real CIDs, since `parseCid` checks them.
 */
const ROOT_CID = 'bafkreicbdlije3hee3wjricfxvt74iptpxbuuy2enuddujwgz7n6mqm5eq'
const SHOT_CID = 'bafkreidardgm3sprwbh2xbgvdbdok6wqwncg3psjbt5yrb3da2z2536one'
const parsedManifest = {
  name: 'Roller Coaster',
  resources: {
    '/': {src: parseCid(ROOT_CID), 'content-type': 'text/html'},
    '/banner.png': {
      src: {
        $type: 'blob',
        ref: parseCid(SHOT_CID),
        mimeType: 'image/png',
        size: 327421,
      },
      'content-type': 'image/png',
    },
  },
  screenshots: [{src: '/banner.png'}],
} as unknown as TileManifest

describe('tileResourceCid', () => {
  it('reads cid-link and blob-ref sources, with or without the leading slash', () => {
    expect(tileResourceCid(manifest, '/')).toBe('bafyroot')
    expect(tileResourceCid(manifest, '/shot.png')).toBe('bafyshot')
    expect(tileResourceCid(manifest, 'shot.png')).toBe('bafyshot')
    expect(tileResourceCid(manifest, '/missing.png')).toBe(undefined)
  })

  it('reads the Cid instances a lex-parsed record carries', () => {
    expect(tileResourceCid(parsedManifest, '/')).toBe(ROOT_CID)
    expect(tileResourceCid(parsedManifest, '/banner.png')).toBe(SHOT_CID)
    expect(tileResourceCid(parsedManifest, 'banner.png')).toBe(SHOT_CID)
  })
})

describe('tileBlobUrl', () => {
  it('builds a getBlob URL on the PDS', () => {
    expect(tileBlobUrl('https://pds.test', 'did:plc:a', 'bafyshot')).toBe(
      'https://pds.test/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Aa&cid=bafyshot',
    )
  })
})

describe('tileScreenshotUrl', () => {
  it('points at the first screenshot blob, or nothing', () => {
    expect(tileScreenshotUrl(manifest, 'https://pds.test', 'did:plc:a')).toBe(
      'https://pds.test/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Aa&cid=bafyshot',
    )
    expect(
      tileScreenshotUrl({...manifest, screenshots: []}, 'https://p.test', 'd'),
    ).toBe(undefined)
  })

  it('finds the screenshot in a lex-parsed record', () => {
    expect(
      tileScreenshotUrl(parsedManifest, 'https://pds.test', 'did:plc:a'),
    ).toBe(
      `https://pds.test/xrpc/com.atproto.sync.getBlob?did=did%3Aplc%3Aa&cid=${SHOT_CID}`,
    )
  })
})
