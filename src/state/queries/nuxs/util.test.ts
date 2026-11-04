import {Nux} from './definitions'
import {parseAppNux, serializeAppNux} from './util'

it('ignores retired announcements without modifying the stored record', () => {
  const stored = Object.freeze({
    id: 'IPadBetaAnnouncement',
    completed: true,
    data: undefined,
  })
  expect(parseAppNux(stored)).toBeUndefined()
  expect(stored).toEqual({
    id: 'IPadBetaAnnouncement',
    completed: true,
    data: undefined,
  })
})

it('still parses and serializes active announcements', () => {
  const stored = {id: Nux.InviteFriendsAnnouncement, completed: true}
  const parsed = parseAppNux(stored)
  expect(parsed).toEqual({...stored, data: undefined})
  expect(serializeAppNux(parsed!)).toEqual({...stored, data: undefined})
})
