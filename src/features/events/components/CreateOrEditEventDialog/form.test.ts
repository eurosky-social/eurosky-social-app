import {type EventRecord} from '../../types'
import {fromRecord, toRecord, validate} from './form'

function blob(cid: string, mimeType = 'image/jpeg') {
  return {$type: 'blob' as const, ref: {$link: cid}, mimeType, size: 1}
}

const existing: EventRecord = {
  uri: 'at://did:plc:alice/community.lexicon.calendar.event/abc',
  cid: 'cid',
  did: 'did:plc:alice',
  collection: 'community.lexicon.calendar.event',
  rkey: 'abc',
  time_us: 0,
  value: {
    $type: 'community.lexicon.calendar.event',
    name: 'Meetup',
    startsAt: '2026-11-01T18:00:00.000Z',
    createdAt: '2026-10-01T00:00:00.000Z',
    mode: 'community.lexicon.calendar.event#inperson',
    locations: [
      {$type: 'community.lexicon.location.geo', latitude: '52', longitude: '4'},
      {
        $type: 'community.lexicon.location.address',
        name: 'Library',
        locality: 'Amsterdam',
        country: 'NL',
      },
    ],
    uris: [{uri: 'https://a.example'}, {uri: 'https://b.example'}],
    media: [
      {role: 'video', content: blob('bafyvideo', 'video/mp4')},
      {role: 'banner', alt: 'Old', content: blob('bafybanner')},
    ],
  },
}

describe('event form', () => {
  it('round-trips an event without losing fields the form does not edit', () => {
    const record = toRecord(fromRecord(existing), existing)
    expect(record.media).toEqual(existing.value.media)
    expect(record.createdAt).toBe(existing.value.createdAt)
    expect(record.uris).toEqual([
      {uri: 'https://a.example', name: undefined},
      {uri: 'https://b.example'},
    ])
    expect(record.locations).toEqual([
      {
        $type: 'community.lexicon.location.address',
        name: 'Library',
        street: undefined,
        locality: 'Amsterdam',
        country: 'NL',
      },
      {$type: 'community.lexicon.location.geo', latitude: '52', longitude: '4'},
    ])
  })

  it('updates the alt text of the existing image in place', () => {
    const values = {...fromRecord(existing), imageAlt: 'New alt'}
    expect(toRecord(values, existing).media).toEqual([
      {role: 'video', content: blob('bafyvideo', 'video/mp4')},
      {role: 'banner', alt: 'New alt', content: blob('bafybanner')},
    ])
  })

  it('replaces the image with an upload, or removes it', () => {
    const upload = {
      path: 'file:///a.jpg',
      mime: 'image/jpeg',
      width: 1600,
      height: 900,
    }
    const replaced = toRecord(
      {...fromRecord(existing), image: {uri: upload.path, upload}},
      existing,
      blob('bafynew'),
    )
    expect(replaced.media).toEqual([
      {role: 'video', content: blob('bafyvideo', 'video/mp4')},
      {
        role: 'banner',
        content: blob('bafynew'),
        alt: 'Old',
        aspect_ratio: {width: 1600, height: 900},
      },
    ])

    const removed = toRecord(
      {...fromRecord(existing), image: undefined},
      existing,
    )
    expect(removed.media).toEqual([
      {role: 'video', content: blob('bafyvideo', 'video/mp4')},
    ])
  })

  it('drops the address of a virtual event but keeps other locations', () => {
    const values = {
      ...fromRecord(existing),
      mode: 'community.lexicon.calendar.event#virtual' as const,
    }
    expect(toRecord(values, existing).locations).toEqual([
      {$type: 'community.lexicon.location.geo', latitude: '52', longitude: '4'},
    ])
  })

  it('validates required fields, dates, country and link', () => {
    const start = new Date('2026-11-01T18:00:00Z')
    expect(validate(fromRecord())).toEqual({
      name: 'required',
      startsAt: 'required',
    })
    expect(
      validate({
        ...fromRecord(),
        name: 'x',
        startsAt: start,
        endsAt: start,
        locality: 'Amsterdam',
        country: 'Netherlands',
        linkUri: 'ftp://nope',
      }),
    ).toEqual({
      endsAt: 'endBeforeStart',
      country: 'invalidCountry',
      linkUri: 'invalidUrl',
    })
  })
})
