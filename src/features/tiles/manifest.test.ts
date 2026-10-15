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

describe('tileResourceCid', () => {
  it('reads cid-link and blob-ref sources, with or without the leading slash', () => {
    expect(tileResourceCid(manifest, '/')).toBe('bafyroot')
    expect(tileResourceCid(manifest, '/shot.png')).toBe('bafyshot')
    expect(tileResourceCid(manifest, 'shot.png')).toBe('bafyshot')
    expect(tileResourceCid(manifest, '/missing.png')).toBe(undefined)
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
})
