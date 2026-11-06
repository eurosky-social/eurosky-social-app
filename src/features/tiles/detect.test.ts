import {findTileUris, isTileUri, parseTileUri, tileUriFromInput} from './detect'

const DID = 'did:plc:izttpdp3l6vss5crelt5kcux'
const URI = `at://${DID}/ing.dasl.masl/3mcjwwoqjqs2v`

describe('parseTileUri', () => {
  it('parses a tile at-URI with a DID repo', () => {
    expect(parseTileUri(URI)).toEqual({
      uri: URI,
      repo: DID,
      rkey: '3mcjwwoqjqs2v',
    })
  })

  it('parses a handle repo and ignores surrounding whitespace', () => {
    expect(
      parseTileUri('  at://robin.berjon.com/ing.dasl.masl/abc-1.2 \n'),
    ).toEqual({
      uri: 'at://robin.berjon.com/ing.dasl.masl/abc-1.2',
      repo: 'robin.berjon.com',
      rkey: 'abc-1.2',
    })
  })

  it('rejects other collections, https URLs and partial URIs', () => {
    expect(parseTileUri(`at://${DID}/app.bsky.feed.post/3mcjwwoqjqs2v`)).toBe(
      undefined,
    )
    expect(parseTileUri(`at://${DID}/ing.dasl.masl`)).toBe(undefined)
    expect(parseTileUri(`at://${DID}/ing.dasl.masl/`)).toBe(undefined)
    expect(parseTileUri(`at://${DID}/ing.dasl.masl/x/y`)).toBe(undefined)
    expect(parseTileUri(`https://webtil.es/${DID}/ing.dasl.masl/x`)).toBe(
      undefined,
    )
    expect(parseTileUri(`${URI} and more`)).toBe(undefined)
    expect(isTileUri('')).toBe(false)
  })
})

describe('tileUriFromInput', () => {
  it('forgives whitespace, wrapping and trailing punctuation', () => {
    expect(tileUriFromInput(`  ${URI}\n`)).toBe(URI)
    expect(tileUriFromInput(`<${URI}>`)).toBe(URI)
    expect(tileUriFromInput(`"${URI}".`)).toBe(URI)
  })

  it('wants exactly one tile URI', () => {
    expect(tileUriFromInput('')).toBe(undefined)
    expect(tileUriFromInput('https://dasl.ing/')).toBe(undefined)
    expect(tileUriFromInput(`${URI} ${URI}`)).toBe(undefined)
    expect(
      tileUriFromInput(`at://${DID}/app.bsky.feed.post/3mcjwwoqjqs2v`),
    ).toBe(undefined)
  })
})

describe('findTileUris', () => {
  it('finds distinct tile URIs in text, without trailing punctuation', () => {
    const other = `at://${DID}/ing.dasl.masl/3other`
    expect(
      findTileUris(`Look at ${URI}. Also ${other}, and again ${URI}!`),
    ).toEqual([URI, other])
  })

  it('ignores non-tile at-URIs', () => {
    expect(
      findTileUris(`at://${DID}/app.bsky.feed.post/3mcjwwoqjqs2v`),
    ).toEqual([])
  })
})
