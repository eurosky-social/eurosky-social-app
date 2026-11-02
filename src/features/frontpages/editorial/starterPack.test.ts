import {describe, expect, it} from '@jest/globals'

import {type app} from '#/lexicons'
import {starterPackFollowCandidates} from './starterPack'

const DID = 'did:plc:viewer'
function member(
  id: string,
  viewer?: app.bsky.actor.defs.ViewerState,
): app.bsky.graph.defs.ListItemView {
  return {
    uri: `at://${DID}/app.bsky.graph.listitem/${id}`,
    subject: {did: `did:plc:${id}`, handle: `${id}.example`, viewer},
  }
}

describe('starter-pack bulk follows', () => {
  it('skips self, existing follows, opted-out, muted, blocked and duplicate members', () => {
    const optedOut = {...member('optedout'), subjectOptedOut: true as const}
    const result = starterPackFollowCandidates(
      [
        member('viewer'),
        member('one'),
        member('one'),
        optedOut,
        member('followed', {following: `at://${DID}/app.bsky.graph.follow/a`}),
        member('blocked', {blockedBy: true}),
        member('blocking', {blocking: `at://${DID}/app.bsky.graph.block/a`}),
        member('muted', {muted: true}),
        member('two'),
      ],
      DID,
    )
    expect(result).toEqual(['did:plc:one', 'did:plc:two'])
  })
  it('has no writes to do for an empty or already-followed pack', () => {
    expect(starterPackFollowCandidates([], DID)).toEqual([])
    expect(
      starterPackFollowCandidates(
        [member('one', {following: `at://${DID}/app.bsky.graph.follow/a`})],
        DID,
      ),
    ).toEqual([])
  })
})
