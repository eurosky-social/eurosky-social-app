import {type EventRecord, type FollowingRsvp, type RsvpRecord} from '../types'
import {pickEventAttendees} from './EventAttendees'

// Only the pure helper is tested; keep the component's app imports out of Jest.
jest.mock('#/state/queries/profile', () => ({}))
jest.mock('#/components/AvatarStack', () => ({}))
jest.mock('../queries', () => ({}))

describe('pickEventAttendees', () => {
  const eventUri = 'at://did:plc:org/community.lexicon.calendar.event/1'

  function rsvp(did: string) {
    return {did} as RsvpRecord
  }

  function friend(did: string, status: FollowingRsvp['status']) {
    return {eventUri, did, status}
  }

  const event = {
    uri: eventUri,
    rsvps: {
      'community.lexicon.calendar.rsvp#interested': [rsvp('d'), rsvp('e')],
      'community.lexicon.calendar.rsvp#going': [rsvp('b'), rsvp('c')],
    },
  } as unknown as EventRecord

  it('lists going before interested', () => {
    expect(pickEventAttendees(event, [], 10)).toEqual(['b', 'c', 'd', 'e'])
  })

  it('puts friends first, going before interested', () => {
    const friends = [friend('x', 'interested'), friend('y', 'going')]
    expect(pickEventAttendees(event, friends, 3)).toEqual(['y', 'x', 'b'])
  })

  it('skips friends who are not going and duplicates', () => {
    const friends = [friend('c', 'going'), friend('z', 'notgoing')]
    expect(pickEventAttendees(event, friends, 10)).toEqual(['c', 'b', 'd', 'e'])
  })
})
