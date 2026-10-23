import {BRAND} from '#/config/brand'
import {parseAtmoRsvpEvent} from './detect'

describe('parseAtmoRsvpEvent', () => {
  const host = `https://${BRAND.web.hosts[0]}`

  it('parses atmo.rsvp links', () => {
    expect(
      parseAtmoRsvpEvent('https://atmo.rsvp/p/alice.test/e/3kxyz'),
    ).toEqual({actor: 'alice.test', rkey: '3kxyz', isBrandLink: false})
  })

  it("parses links to the brand's own event pages", () => {
    expect(parseAtmoRsvpEvent(`${host}/events/alice.test/3kxyz`)).toEqual({
      actor: 'alice.test',
      rkey: '3kxyz',
      isBrandLink: true,
    })
    expect(parseAtmoRsvpEvent(`${host}/events/did:plc:abc/3kxyz/?x=1`)).toEqual(
      {actor: 'did:plc:abc', rkey: '3kxyz', isBrandLink: true},
    )
  })

  it('ignores other pages and hosts', () => {
    expect(parseAtmoRsvpEvent(`${host}/events/alice.test/3kxyz/rsvps`)).toBe(
      null,
    )
    expect(parseAtmoRsvpEvent(`${host}/events`)).toBe(null)
    expect(parseAtmoRsvpEvent('https://example.com/events/a/b')).toBe(null)
  })
})
