import {type BlobRef} from '@atproto/lex'

import {
  keepSavedHeaderOrder,
  profileHeaderLinkIndex,
  profileHeaderLinks,
} from './header'
import {mergeLegacyWebsite} from './legacy'
import {type OwnProfileLinks, type ProfileLink} from './types'

const a: ProfileLink = {
  url: 'https://a.example',
  uri: 'at://did:plc:alice/app.bsky.actor.link/a',
  cid: 'cid-a',
  title: 'A',
}
const b: ProfileLink = {
  url: 'https://b.example',
  uri: 'at://did:plc:alice/app.bsky.actor.link/b',
  cid: 'cid-b',
  title: 'B',
}
function repo(links: ProfileLink[], website?: string): OwnProfileLinks {
  const urls = links.map(link => link.url)
  return {
    links: mergeLegacyWebsite(links, website, urls, true),
    refs: links.flatMap(link =>
      link.uri && link.cid ? [{uri: link.uri, cid: link.cid}] : [],
    ),
    website,
    urls,
  }
}

describe('stable profile header presentation', () => {
  it('uses the displayed links before the editing records load', () => {
    const displayed = mergeLegacyWebsite([b, a], 'https://a.example/', [
      b.url,
      a.url,
    ])
    expect(profileHeaderLinks(displayed, undefined)).toBe(displayed)
    expect(displayed).toHaveLength(2)
  })

  it('does not resort a duplicate website when the repo arrives in a different order', () => {
    const displayed = mergeLegacyWebsite([b, a], 'https://a.example/', [
      b.url,
      a.url,
    ])
    const snapshot = repo([a, b], 'https://a.example/')
    const loaded = profileHeaderLinks(displayed, snapshot)
    expect(loaded.map(link => link.url)).toEqual(
      displayed.map(link => link.url),
    )
    expect(loaded).toHaveLength(2)
    expect(snapshot.links).toEqual([a, b])
    expect(profileHeaderLinkIndex(loaded[0], snapshot)).toBe(1)
    expect(profileHeaderLinkIndex(loaded[1], snapshot)).toBe(0)
  })

  it('keeps a website in its slot when its duplicate native record becomes available', () => {
    const displayed = mergeLegacyWebsite([b], 'https://a.example/', [b.url])
    const loaded = profileHeaderLinks(
      displayed,
      repo([a, b], 'https://a.example/'),
    )
    expect(loaded).toEqual([b, a])
    expect(loaded[1].legacyWebsite).toBeUndefined()
    expect(loaded[1].uri).toBe(a.uri)
  })

  it('renders an unconverted website through the same link data without moving it', () => {
    const displayed = mergeLegacyWebsite([b], 'https://a.example/', [b.url])
    const loaded = profileHeaderLinks(
      displayed,
      repo([b], 'https://a.example/'),
    )
    expect(loaded).toEqual(displayed)
    expect(
      profileHeaderLinkIndex(loaded[1], repo([b], 'https://a.example/')),
    ).toBe(1)
  })

  it('retains the same favicon URL instead of reloading from a different CDN path', () => {
    const displayed = [{...a, iconUrl: 'https://cdn.example/stored-icon.png'}]
    const snapshot = repo([{...a, icon: {} as BlobRef}])
    const [loaded] = profileHeaderLinks(displayed, snapshot)
    expect(loaded.iconUrl).toBe(displayed[0].iconUrl)
    expect(loaded.icon).toBe(snapshot.links[0].icon)
    expect(snapshot.links[0].iconUrl).toBeUndefined()
  })

  it('does not reuse an old favicon for a newly edited record', () => {
    const displayed = [{...a, iconUrl: 'https://cdn.example/old-icon.png'}]
    const [loaded] = profileHeaderLinks(
      displayed,
      repo([{...a, cid: 'new-cid', icon: {} as BlobRef}]),
    )
    expect(loaded.iconUrl).toBeUndefined()
  })

  it('appends newly discovered entries without shuffling those already visible', () => {
    expect(profileHeaderLinks([b], repo([a, b]))).toEqual([b, a])
  })

  it('allows an explicit save/reorder to update the order immediately', () => {
    const snapshot = {...repo([a, b]), locallySaved: true}
    expect(profileHeaderLinks([b, a], snapshot)).toEqual([a, b])
  })

  it('does not preserve links that were actually removed', () => {
    expect(profileHeaderLinks([a, b], repo([b]))).toEqual([b])
    expect(profileHeaderLinkIndex(a, repo([b]))).toBe(-1)
  })
})

describe('local save order across background refetches', () => {
  it('keeps an explicit save authoritative while the repo state is unchanged', () => {
    const previous = {...repo([a, b]), locallySaved: true}
    expect(keepSavedHeaderOrder(previous, repo([a, b]))).toBe(true)
    expect(keepSavedHeaderOrder(repo([a, b]), repo([a, b]))).toBe(false)
    expect(keepSavedHeaderOrder(undefined, repo([a, b]))).toBe(false)
  })

  it('releases the local override when another client changes the repo state', () => {
    const previous = {...repo([a, b]), locallySaved: true}
    for (const next of [
      repo([b, a]),
      repo([a]),
      repo([{...a, cid: 'new-cid'}, b]),
      repo([a, b], 'https://new.example/'),
    ]) {
      expect(keepSavedHeaderOrder(previous, next)).toBe(false)
    }
  })
})
